/**
 * The signed-in member's company role, read from the team list, for later phases to hide actions
 * the member would only be refused. This is a convenience, not security: the API does not enforce
 * company roles outside team management (a documented backend gap), so nothing may rely on it.
 */
import {
  canManage,
  currentMember,
  isOwner,
  primaryRole,
  type CompanyRole,
  type TeamMemberView,
} from '@tradevistar/seller-api';
import { useMemo } from 'react';
import { useTeam } from './data';

export interface CompanyRoleInfo {
  /** Null until the team list has loaded (or when the member is not in it). */
  member: TeamMemberView | null;
  role: CompanyRole | null;
  isOwner: boolean;
  /** Owner or Admin: may manage the team. */
  canManageTeam: boolean;
  loaded: boolean;
}

export function useCompanyRole(): CompanyRoleInfo {
  const team = useTeam();
  return useMemo(() => {
    const member = team.data ? currentMember(team.data) : null;
    return {
      member,
      role: member ? primaryRole(member.companyRoles) : null,
      isOwner: isOwner(member),
      canManageTeam: canManage(member),
      loaded: team.data !== undefined,
    };
  }, [team.data]);
}
