/**
 * Team (`/seller/profile/team*`): members, invitations, roles, status and ownership transfer.
 * The server decides who may do what; the domain helpers (`domain/team.ts`) only hide actions.
 */
import { api } from "../http/client";

export type CompanyRole =
  | "OWNER"
  | "ADMIN"
  | "OPERATIONS_MANAGER"
  | "CATALOG_MANAGER"
  | "SALES_MANAGER"
  | "FINANCE_MANAGER"
  | "LOGISTICS_MANAGER"
  | "MARKETING_MANAGER"
  | "SUPPORT_MANAGER"
  | "VIEWER";

export type MemberStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type InvitationStatus = "INVITED" | "ACCEPTED" | "EXPIRED" | "REVOKED" | "DISABLED";

export interface TeamMemberView {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  companyRoles: CompanyRole[];
  isOwner: boolean;
  isCurrentUser: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
}

export interface InvitationView {
  id: string;
  email: string;
  roles: CompanyRole[];
  status: InvitationStatus;
  expiresAt: string;
  invitedByUserId: string;
  lastSentAt: string;
  sendCount: number;
  createdAt: string;
}

export const listTeam = (signal?: AbortSignal) =>
  api.get<TeamMemberView[]>("/seller/profile/team", { requireAuth: true, signal });

export const listInvitations = (signal?: AbortSignal) =>
  api.get<InvitationView[]>("/seller/profile/team/invitations", { requireAuth: true, signal });

export interface InviteResult {
  invitation: InvitationView;
  /** Returned once; it is the only chance to share the link. */
  token: string;
  emailSent: boolean;
}

export const inviteUser = (body: { email: string; roles: CompanyRole[] }) =>
  api.post<InviteResult>("/seller/profile/team/invitations", body, { requireAuth: true });

export const resendInvitation = (id: string) =>
  api.post<{ token: string; emailSent: boolean }>(
    `/seller/profile/team/invitations/${encodeURIComponent(id)}/resend`,
    undefined,
    { requireAuth: true },
  );

export const revokeInvitation = (id: string) =>
  api.delete<{ revoked: true }>(`/seller/profile/team/invitations/${encodeURIComponent(id)}`, { requireAuth: true });

export const updateMemberRoles = (membershipId: string, roles: CompanyRole[]) =>
  api.patch<TeamMemberView>(`/seller/profile/team/${encodeURIComponent(membershipId)}/roles`, { roles }, {
    requireAuth: true,
  });

export const setMemberStatus = (membershipId: string, status: MemberStatus) =>
  api.patch<{ updated: true }>(`/seller/profile/team/${encodeURIComponent(membershipId)}/status`, { status }, {
    requireAuth: true,
  });

export const transferOwnership = (membershipId: string) =>
  api.post<{ transferred: true }>(
    `/seller/profile/team/${encodeURIComponent(membershipId)}/transfer-ownership`,
    undefined,
    { requireAuth: true },
  );
