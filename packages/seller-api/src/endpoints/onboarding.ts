/**
 * Onboarding and team invitations.
 *
 * - A staff-created onboarding invitation (`…/seller/register?onboardingInvite=<token>`) pre-fills
 *   the registration form. The prefill is public; the seller still verifies both codes.
 * - A team invitation (`…/seller/invitations/accept?token=<token>`) adds a signed-in seller to a
 *   company. Accepting needs a session and is allowed while the seller is unverified.
 */
import { api } from "../http/client";

export interface OnboardingInvitePrefill {
  phone: string;
  email: string;
  companyName: string;
  gstin: string;
  categoryCode: string;
  businessCountryCode: string;
}

export const getOnboardingInvitePrefill = (token: string, signal?: AbortSignal) =>
  api.get<OnboardingInvitePrefill>(`/onboarding/invitations/prefill?token=${encodeURIComponent(token)}`, {
    skipAuth: true,
    signal,
  });

export const acceptTeamInvitation = (token: string) =>
  api.post<{ organizationId: string }>("/seller/profile/team/invitations/accept", { token });
