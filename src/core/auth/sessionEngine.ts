/**
 * The session lifecycle, with no UI and no React: launch restore, sign-in, foreground refresh and
 * sign-out. Everything it touches is injected, so every path is unit-tested.
 *
 * States:
 * - `restoring`: launch, reading the Keychain and refreshing;
 * - `signedIn`: a seller session is live;
 * - `signedOut`: no session (with why, when it ended on its own);
 * - `offline`: credentials are stored but the server could not be reached. The seller is *not*
 *   signed out; `retry()`, reconnecting or the next foreground tries again. The last known
 *   profile (if any) comes along, so the app can still show who is signed in.
 */
import {
  ApiError,
  errorMessage,
  hasSellerRole,
  isTwoFactorChallenge,
  type AuthResponse,
  type AuthUser,
  type CodeTiming,
  type Role,
  type SessionEndDetail,
  type SessionEndReason,
  type SignInResponse,
  type TwoFactorChallenge,
} from '@tradevistar/seller-api';

/**
 * Why there is no session. The two approval reasons carry the server's own message (the
 * rejection reason is part of it) and are shown once on the approval screen; they are never
 * stored, so the next launch starts at sign-in.
 */
export type SignedOutReason =
  | 'signedOut'
  | 'expired'
  | 'roleRejected'
  | 'noSession'
  | 'approvalPending'
  | 'approvalRejected';

export type SessionState =
  | { status: 'restoring' }
  | { status: 'signedIn'; user: AuthUser; activeRole: Role }
  | { status: 'signedOut'; reason: SignedOutReason; message?: string }
  | { status: 'offline'; message: string; user: AuthUser | null };

export type ApprovalKind = 'pending' | 'rejected';

/** What a sign-in produced: a session, a second factor still to enter, or an approval hold. */
export type SignInOutcome =
  | { kind: 'signedIn'; user: AuthUser }
  | { kind: 'twoFactorRequired'; challenge: TwoFactorChallenge }
  | { kind: 'approval'; approval: ApprovalKind; message: string };

const APPROVAL_CODES: Record<string, ApprovalKind> = {
  SELLER_APPROVAL_PENDING: 'pending',
  SELLER_REJECTED: 'rejected',
};

function approvalOf(error: unknown): ApprovalKind | null {
  return error instanceof ApiError && error.statusCode === 403
    ? APPROVAL_CODES[error.code] ?? null
    : null;
}

const APPROVAL_REASON: Record<ApprovalKind, SignedOutReason> = {
  pending: 'approvalPending',
  rejected: 'approvalRejected',
};

export interface SessionDeps {
  hasRefreshToken(): Promise<boolean>;
  clearRefreshToken(): Promise<void>;
  /** Trades the stored refresh token for a session (shared single-flight refresh). */
  refresh(): Promise<AuthResponse>;
  loginWithPassword(
    identifier: string,
    password: string,
    rememberMe: boolean,
  ): Promise<SignInResponse>;
  loginWithOtp(
    identifier: string,
    code: string,
    rememberMe: boolean,
  ): Promise<SignInResponse>;
  verifyTwoFactor(challengeToken: string, code: string): Promise<AuthResponse>;
  resendTwoFactor(challengeToken: string): Promise<CodeTiming>;
  /** The last signed-in profile, kept for offline launches; wiped with user data. */
  readCachedUser?(): AuthUser | null;
  writeCachedUser?(user: AuthUser): void;
  logout(): Promise<void>;
  setAccessToken(token: string | null): void;
  /** Refreshes when the access token expires within `aheadMs`. */
  ensureFreshAccessToken(aheadMs: number): Promise<string | null>;
  /** Drops cached server data and user-scoped preferences. */
  clearUserData(): void;
  /** Runs after every successful sign-in or restore. */
  afterSignIn?(user: AuthUser): Promise<void>;
  /** Runs before sign-out while the session is still valid. */
  beforeSignOut?(): Promise<void>;
  log?(message: string, error?: unknown): void;
}

/** How long before expiry a returning app refreshes, wider than the per-request 30 s. */
export const FOREGROUND_REFRESH_AHEAD_MS = 60_000;

type Listener = (state: SessionState) => void;

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.isNetworkError ||
      error.statusCode === 0 ||
      error.statusCode >= 500 ||
      error.statusCode === 429)
  );
}

/** Thrown by sign-in when the account is not a seller account. */
export class NotASellerError extends Error {
  constructor() {
    super(
      'This account is not registered as a seller. Sign in with a seller account.',
    );
    this.name = 'NotASellerError';
  }
}

function isRoleRejection(error: unknown): boolean {
  return (
    error instanceof NotASellerError ||
    (error instanceof ApiError && error.code === 'ROLE_NOT_ALLOWED')
  );
}

export class SessionEngine {
  private state: SessionState = { status: 'restoring' };
  private readonly listeners = new Set<Listener>();
  private restoring: Promise<void> | null = null;
  private signingOut: Promise<void> | null = null;

  constructor(private readonly deps: SessionDeps) {}

  getState(): SessionState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: SessionState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private log(message: string, error?: unknown): void {
    this.deps.log?.(message, error);
  }

  /** App launch: Keychain → refresh → user. Safe to call repeatedly; concurrent calls share one run. */
  start(): Promise<void> {
    if (!this.restoring) {
      this.restoring = this.restore().finally(() => {
        this.restoring = null;
      });
    }
    return this.restoring;
  }

  /** Retries a restore that failed for lack of network. */
  retry(): Promise<void> {
    return this.start();
  }

  private async restore(): Promise<void> {
    this.setState({ status: 'restoring' });
    let stored: boolean;
    try {
      stored = await this.deps.hasRefreshToken();
    } catch (error) {
      // An unreadable keystore entry (e.g. after a device restore) cannot be recovered.
      this.log('Keychain read failed', error);
      await this.wipeLocal();
      this.setState({ status: 'signedOut', reason: 'noSession' });
      return;
    }
    if (!stored) {
      this.setState({ status: 'signedOut', reason: 'noSession' });
      return;
    }

    try {
      const session = await this.deps.refresh();
      await this.adopt(session);
    } catch (error) {
      const approval = approvalOf(error);
      if (approval) {
        await this.wipeLocal();
        this.setApproval(approval, (error as ApiError).message);
      } else if (isRoleRejection(error)) {
        await this.wipeLocal();
        this.setState({ status: 'signedOut', reason: 'roleRejected' });
      } else if (isNetworkFailure(error)) {
        this.setState({
          status: 'offline',
          message: errorMessage(
            error,
            "We couldn't reach TradeVistar. Check your connection and try again.",
          ),
          user: this.cachedUser(),
        });
      } else {
        this.log('Session restore rejected', error);
        await this.wipeLocal();
        this.setState({ status: 'signedOut', reason: 'expired' });
      }
    }
  }

  /**
   * Accepts a session only for a seller. The API client already refuses other roles before
   * anything is stored; this is the second lock, so no path can leave a buyer or admin session
   * behind the seller shell.
   */
  private async adopt(session: AuthResponse): Promise<AuthUser> {
    if (!hasSellerRole(session.user)) {
      // Revoke the session server-side so its refresh token dies too, then forget it.
      this.deps.setAccessToken(session.accessToken);
      await this.deps
        .logout()
        .catch(error => this.log('Logout of non-seller session failed', error));
      await this.wipeLocal();
      throw new NotASellerError();
    }
    // Sign-in responses carry the first access token; only refresh stored it before.
    this.deps.setAccessToken(session.accessToken);
    this.setState({
      status: 'signedIn',
      user: session.user,
      activeRole: session.activeRole,
    });
    this.rememberUser(session.user);
    if (this.deps.afterSignIn) {
      // Post sign-in work must never block or fail sign-in.
      this.deps
        .afterSignIn(session.user)
        .catch(error => this.log('Post sign-in task failed', error));
    }
    return session.user;
  }

  /**
   * Password sign-in. Errors propagate so the screen can show them — including 423 (locked),
   * whose message from the API says when the seller may try again.
   */
  async signInWithPassword(
    identifier: string,
    password: string,
    rememberMe = true,
  ): Promise<SignInOutcome> {
    return this.signIn(() =>
      this.deps.loginWithPassword(identifier, password, rememberMe),
    );
  }

  /**
   * OTP sign-in. An account with two-factor on may still ask for a different channel, so the
   * outcome can be a challenge here too.
   */
  async signInWithOtp(
    identifier: string,
    code: string,
    rememberMe = true,
  ): Promise<SignInOutcome> {
    return this.signIn(() =>
      this.deps.loginWithOtp(identifier, code, rememberMe),
    );
  }

  /** Completes a two-factor challenge. The challenge token never leaves memory. */
  async verifyTwoFactor(
    challengeToken: string,
    code: string,
  ): Promise<SignInOutcome> {
    return this.signIn(() => this.deps.verifyTwoFactor(challengeToken, code));
  }

  resendTwoFactor(challengeToken: string): Promise<CodeTiming> {
    return this.deps.resendTwoFactor(challengeToken);
  }

  /**
   * Runs one sign-in call and turns its good endings into an outcome. A pending or rejected
   * seller is not an error to show on the form: the session state moves to the approval screen,
   * and nothing from the attempt stays on the device.
   */
  private async signIn(
    call: () => Promise<SignInResponse>,
  ): Promise<SignInOutcome> {
    let response: SignInResponse;
    try {
      response = await call();
    } catch (error) {
      const approval = approvalOf(error);
      if (!approval) throw error;
      await this.wipeLocal();
      const message = (error as ApiError).message;
      this.setApproval(approval, message);
      return { kind: 'approval', approval, message };
    }
    if (isTwoFactorChallenge(response)) {
      return { kind: 'twoFactorRequired', challenge: response };
    }
    return { kind: 'signedIn', user: await this.adopt(response) };
  }

  private setApproval(approval: ApprovalKind, message: string): void {
    this.setState({
      status: 'signedOut',
      reason: APPROVAL_REASON[approval],
      message,
    });
  }

  /** "Try signing in again" / "Use another account": leaves the approval screen. */
  dismissApproval(): void {
    const state = this.state;
    if (
      state.status === 'signedOut' &&
      (state.reason === 'approvalPending' ||
        state.reason === 'approvalRejected')
    ) {
      this.setState({ status: 'signedOut', reason: 'noSession' });
    }
  }

  private cachedUser(): AuthUser | null {
    try {
      const user = this.deps.readCachedUser?.() ?? null;
      return user && hasSellerRole(user) ? user : null;
    } catch (error) {
      this.log('Cached user unreadable', error);
      return null;
    }
  }

  private rememberUser(user: AuthUser): void {
    try {
      this.deps.writeCachedUser?.(user);
    } catch (error) {
      this.log('Caching the user failed', error);
    }
  }

  /** Called on return to the foreground. */
  async onForeground(): Promise<void> {
    if (this.state.status === 'offline') {
      await this.start();
      return;
    }
    if (this.state.status !== 'signedIn') return;
    try {
      await this.deps.ensureFreshAccessToken(FOREGROUND_REFRESH_AHEAD_MS);
    } catch (error) {
      // A rejected refresh reports through onSessionEnded; a network failure just waits.
      this.log('Foreground refresh failed', error);
    }
  }

  /**
   * Trades the refresh token for a new access token straight away. A password change and a login
   * email or mobile change both bump the account version on the server, so the access token this
   * phone holds stops working; renewing first means the next request does not fail once and rely
   * on the retry. The refresh token of this phone's own session survives those changes.
   */
  async renewSession(): Promise<void> {
    if (this.state.status !== 'signedIn') return;
    const session = await this.deps.refresh();
    if (!hasSellerRole(session.user)) return;
    this.deps.setAccessToken(session.accessToken);
    this.setState({
      status: 'signedIn',
      user: session.user,
      activeRole: session.activeRole,
    });
    this.rememberUser(session.user);
  }

  /** Takes a freshly read profile (a new picture or name) into the signed-in state. */
  adoptUser(user: AuthUser): void {
    const state = this.state;
    if (state.status !== 'signedIn' || user.id !== state.user.id) return;
    this.setState({ ...state, user });
    this.rememberUser(user);
  }

  /** The API client reports that the server ended the session (rejected refresh, repeated 401). */
  async onSessionEnded(
    reason: SessionEndReason = 'refresh_rejected',
    detail?: SessionEndDetail,
  ): Promise<void> {
    if (this.state.status !== 'signedIn' && this.state.status !== 'offline') {
      return;
    }
    await this.wipeLocal();
    if (reason === 'approval_pending' || reason === 'approval_rejected') {
      this.setApproval(
        reason === 'approval_pending' ? 'pending' : 'rejected',
        detail?.message ?? '',
      );
    } else if (reason === 'role_mismatch') {
      this.setState({ status: 'signedOut', reason: 'roleRejected' });
    } else {
      this.setState({ status: 'signedOut', reason: 'expired' });
    }
  }

  /** Revoke the server session → wipe Keychain, cache and user preferences. */
  signOut(): Promise<void> {
    if (!this.signingOut) {
      this.signingOut = this.performSignOut().finally(() => {
        this.signingOut = null;
      });
    }
    return this.signingOut;
  }

  private async performSignOut(): Promise<void> {
    // Each server step is best-effort: signing out must work offline too.
    if (this.deps.beforeSignOut) {
      await this.deps
        .beforeSignOut()
        .catch(error => this.log('Pre sign-out task failed', error));
    }
    await this.deps
      .logout()
      .catch(error => this.log('Server logout failed', error));
    await this.wipeLocal();
    this.setState({ status: 'signedOut', reason: 'signedOut' });
  }

  private async wipeLocal(): Promise<void> {
    this.deps.setAccessToken(null);
    await this.deps
      .clearRefreshToken()
      .catch(error => this.log('Keychain wipe failed', error));
    try {
      this.deps.clearUserData();
    } catch (error) {
      this.log('User data wipe failed', error);
    }
  }
}
