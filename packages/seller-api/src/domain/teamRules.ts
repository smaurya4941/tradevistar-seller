/**
 * Team permission helpers. These decide only what the screen shows: the server enforces every rule,
 * and company roles are not enforced anywhere outside team management (a documented backend gap),
 * so the app must never present them as security.
 */
import type { CompanyRole, InvitationView, InvitationStatus, MemberStatus, TeamMemberView } from "../endpoints/team";

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  OPERATIONS_MANAGER: "Operations manager",
  CATALOG_MANAGER: "Catalog manager",
  SALES_MANAGER: "Sales manager",
  FINANCE_MANAGER: "Finance manager",
  LOGISTICS_MANAGER: "Logistics manager",
  MARKETING_MANAGER: "Marketing manager",
  SUPPORT_MANAGER: "Support manager",
  VIEWER: "Viewer",
};

export const COMPANY_ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  OWNER: "Full control of the company, including ownership transfer.",
  ADMIN: "Manages the team and every area of the seller workspace.",
  OPERATIONS_MANAGER: "Runs day-to-day orders, fulfilment and inventory.",
  CATALOG_MANAGER: "Creates and edits products, categories and brands.",
  SALES_MANAGER: "Handles RFQs, quotations, inquiries and buyer messages.",
  FINANCE_MANAGER: "Views payments, wallet, invoices and bank details.",
  LOGISTICS_MANAGER: "Manages shipments, pickups and delivery partners.",
  MARKETING_MANAGER: "Runs ads, promotions, coupons and banner campaigns.",
  SUPPORT_MANAGER: "Responds to reviews, support tickets and disputes.",
  VIEWER: "Read-only access across the workspace.",
};

/** The nine roles that can be assigned (Owner is never assigned). */
export const ASSIGNABLE_ROLES: readonly CompanyRole[] = [
  "ADMIN",
  "OPERATIONS_MANAGER",
  "CATALOG_MANAGER",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "LOGISTICS_MANAGER",
  "MARKETING_MANAGER",
  "SUPPORT_MANAGER",
  "VIEWER",
];

/** The one role shown for a member: Owner, else the first assignable role they hold. */
export const primaryRole = (roles: readonly CompanyRole[]): CompanyRole | null =>
  roles.includes("OWNER") ? "OWNER" : ASSIGNABLE_ROLES.find((role) => roles.includes(role)) ?? null;

const isOwnerMember = (member: Pick<TeamMemberView, "isOwner" | "companyRoles">) =>
  member.isOwner || member.companyRoles.includes("OWNER");

const isAdminMember = (member: Pick<TeamMemberView, "companyRoles">) => member.companyRoles.includes("ADMIN");

/** The signed-in member's row, if the list has it. */
export const currentMember = (team: readonly TeamMemberView[]): TeamMemberView | null =>
  team.find((member) => member.isCurrentUser) ?? null;

/** The owner, or a member with the Admin role. */
export function canManage(me: TeamMemberView | null): boolean {
  if (!me || me.status !== "ACTIVE") return false;
  return isOwnerMember(me) || isAdminMember(me);
}

/** Manager, target is not the owner, not yourself, and (you are the owner or the target is not an Admin). */
export function canActOn(me: TeamMemberView | null, target: TeamMemberView): boolean {
  if (!canManage(me) || !me) return false;
  if (isOwnerMember(target)) return false;
  if (target.isCurrentUser || target.membershipId === me.membershipId) return false;
  return isOwnerMember(me) || !isAdminMember(target);
}

export const isOwner = (me: TeamMemberView | null): boolean => Boolean(me && isOwnerMember(me));

/** Only the owner can assign Admin, and only the owner transfers ownership. */
export function roleOptionsFor(me: TeamMemberView | null): CompanyRole[] {
  return ASSIGNABLE_ROLES.filter((role) => role !== "ADMIN" || isOwner(me));
}

export function canTransferTo(me: TeamMemberView | null, target: TeamMemberView): boolean {
  return isOwner(me) && target.status === "ACTIVE" && !isOwnerMember(target) && !target.isCurrentUser;
}

export interface MemberActions {
  editRole: boolean;
  disable: boolean;
  enable: boolean;
  remove: boolean;
  transfer: boolean;
}

export function memberActions(me: TeamMemberView | null, target: TeamMemberView): MemberActions {
  const acts = canActOn(me, target) && target.status !== "REMOVED";
  return {
    editRole: acts && target.status !== "INVITED",
    disable: acts && target.status === "ACTIVE",
    enable: acts && target.status === "SUSPENDED",
    remove: acts,
    transfer: canTransferTo(me, target),
  };
}

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  SUSPENDED: "Disabled",
  REMOVED: "Removed",
};

export const MEMBER_STATUS_TONE: Record<MemberStatus, "green" | "orange" | "red" | "gray"> = {
  INVITED: "orange",
  ACTIVE: "green",
  SUSPENDED: "red",
  REMOVED: "gray",
};

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  INVITED: "Invited",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
  DISABLED: "Disabled",
};

export const INVITATION_STATUS_TONE: Record<InvitationStatus, "green" | "orange" | "red" | "gray"> = {
  INVITED: "orange",
  ACCEPTED: "green",
  EXPIRED: "red",
  REVOKED: "gray",
  DISABLED: "gray",
};

/** Resend and revoke are for invitations that are still open or have run out. */
export const invitationOpen = (invitation: Pick<InvitationView, "status">): boolean =>
  invitation.status === "INVITED" || invitation.status === "EXPIRED";

/** The share link: the seller web address plus the invitation path the Phase 1 deep link handles. */
export function buildInviteLink(webUrl: string, token: string): string {
  const base = webUrl.replace(/\/+$/, "");
  return `${base}/seller/invitations/accept?token=${encodeURIComponent(token)}`;
}

export const INVITATION_VALID_DAYS = 7;

export const TEAM_ERROR_CODES = [
  "ALREADY_A_MEMBER",
  "INVITATION_ALREADY_SENT",
  "INVITATION_NOT_RESENDABLE",
  "INVITATION_ALREADY_ACCEPTED",
  "INVITATION_INVALID",
  "INVITATION_EXPIRED",
  "INVITATION_EMAIL_MISMATCH",
  "ROLE_REQUIRED",
  "OWNER_ROLES_IMMUTABLE",
  "OWNER_ROLE_NOT_ASSIGNABLE",
  "OWNER_REQUIRED_FOR_ADMIN",
  "OWNER_PROTECTED",
  "SELF_ACTION_FORBIDDEN",
  "TEAM_ADMIN_REQUIRED",
  "MEMBER_NOT_FOUND",
  "MEMBER_REMOVED",
  "MEMBER_STATUS_INVALID",
  "TARGET_NOT_ACTIVE",
  "ALREADY_OWNER",
] as const;

export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number];

export const isTeamErrorCode = (code: string): code is TeamErrorCode => (TEAM_ERROR_CODES as readonly string[]).includes(code);
