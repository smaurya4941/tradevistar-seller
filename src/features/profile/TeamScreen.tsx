/**
 * Team: members and invitations. What a member sees is a convenience (`canManage`, `canActOn`);
 * the server decides, and its error codes are shown in words. Only the owner assigns Admin and
 * transfers ownership. Invitations last seven days; resend issues a new link and the old one
 * stops working.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  COMPANY_ROLE_DESCRIPTIONS,
  COMPANY_ROLE_LABELS,
  formatDateTime,
  formatFullDate,
  INVITATION_STATUS_LABEL,
  INVITATION_STATUS_TONE,
  invitationOpen,
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_TONE,
  memberActions,
  primaryRole,
  resendInvitation,
  revokeInvitation,
  roleOptionsFor,
  setMemberStatus,
  transferOwnership,
  updateMemberRoles,
  type CompanyRole,
  type InvitationView,
  type TeamMemberView,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { track } from '@/core/analytics/analytics';
import {
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  ChoiceRow,
  colors,
  ConfirmDialog,
  EmptyState,
  SectionTitle,
  spacing,
  StatusBadge,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { InviteLinkSheet } from './components/InviteLinkSheet';
import { LoadGate } from './components/LoadGate';
import { companyKeys, useInvitations, useTeam, useUpdatedLabel } from './data';
import { profileErrorMessage } from './errors';
import { useCompanyRole } from './useCompanyRole';

type Nav = NativeStackNavigationProp<SharedScreens>;
type Pending =
  | {
      kind: 'disable' | 'enable' | 'remove' | 'transfer';
      member: TeamMemberView;
    }
  | { kind: 'revoke'; invitation: InvitationView }
  | null;

export function TeamScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const client = useQueryClient();
  const role = useCompanyRole();
  const team = useTeam();
  const invitations = useInvitations(role.canManageTeam);
  const updated = useUpdatedLabel(team);
  const [acting, setActing] = useState<TeamMemberView | null>(null);
  const [rolePick, setRolePick] = useState<TeamMemberView | null>(null);
  const [chosen, setChosen] = useState<CompanyRole | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{
    token: string;
    email: string;
    emailSent: boolean;
  } | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.team }),
      client.invalidateQueries({ queryKey: companyKeys.invitations }),
    ]);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.show(success, 'success');
      return true;
    } catch (error) {
      void refresh();
      toast.show(profileErrorMessage(error, t), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    const current = pending;
    let done = false;
    if (current.kind === 'revoke') {
      done = await run(
        () => revokeInvitation(current.invitation.id),
        t('team.revoked'),
      );
    } else if (current.kind === 'disable') {
      done = await run(
        () => setMemberStatus(current.member.membershipId, 'SUSPENDED'),
        t('team.disabled'),
      );
    } else if (current.kind === 'enable') {
      done = await run(
        () => setMemberStatus(current.member.membershipId, 'ACTIVE'),
        t('team.enabled'),
      );
    } else if (current.kind === 'remove') {
      done = await run(
        () => setMemberStatus(current.member.membershipId, 'REMOVED'),
        t('team.removed'),
      );
    } else {
      done = await run(
        () => transferOwnership(current.member.membershipId),
        t('team.transferred'),
      );
      if (done) track('team_ownership_transferred', {});
    }
    void done;
    setPending(null);
  };

  const saveRole = async () => {
    if (!rolePick || !chosen) return;
    const member = rolePick;
    const ok = await run(
      () => updateMemberRoles(member.membershipId, [chosen]),
      t('team.roleChanged'),
    );
    if (ok) {
      track('team_role_changed', { role: chosen });
      setRolePick(null);
    }
  };

  const resend = async (invitation: InvitationView) => {
    setBusy(true);
    try {
      const result = await resendInvitation(invitation.id);
      await refresh();
      setLink({
        token: result.token,
        email: invitation.email,
        emailSent: result.emailSent,
      });
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = (item: Pending) => {
    if (!item) return null;
    const name =
      item.kind === 'revoke'
        ? item.invitation.email
        : item.member.fullName ?? item.member.email ?? '';
    return {
      title: t(
        `team.confirm.${item.kind}.title` as 'team.confirm.remove.title',
      ),
      message: t(
        `team.confirm.${item.kind}.body` as 'team.confirm.remove.body',
        { name },
      ),
      label: t(
        `team.confirm.${item.kind}.action` as 'team.confirm.remove.action',
      ),
    };
  };
  const copy = confirmCopy(pending);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-team"
      refreshControl={
        <RefreshControl
          refreshing={team.isFetching && !team.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <LoadGate query={team} updatedLabel={updated}>
        {members => {
          const me = members.find(member => member.isCurrentUser) ?? null;
          const visible = members.filter(member => member.status !== 'REMOVED');
          return (
            <>
              {role.canManageTeam ? (
                <Button
                  label={t('team.invite')}
                  icon="person_add"
                  onPress={() => navigation.navigate('Invite')}
                  testID="team-invite"
                />
              ) : (
                <Banner tone="blue" message={t('team.viewOnly')} />
              )}
              <SectionTitle>{t('team.members')}</SectionTitle>
              {visible.map(member => {
                const main = primaryRole(member.companyRoles);
                const actions = memberActions(me, member);
                const hasActions = Object.values(actions).some(Boolean);
                return (
                  <Card
                    key={member.membershipId}
                    style={styles.card}
                    testID={`member-${member.membershipId}`}
                  >
                    <View style={styles.head}>
                      <View style={styles.flex}>
                        <Text variant="cardTitle">
                          {member.fullName ?? member.email ?? t('team.unnamed')}
                        </Text>
                        {member.fullName && member.email ? (
                          <Text variant="small" color={colors.textMuted}>
                            {member.email}
                          </Text>
                        ) : null}
                        {member.phone ? (
                          <Text variant="small" color={colors.textMuted}>
                            {member.phone}
                          </Text>
                        ) : null}
                      </View>
                      <StatusBadge
                        status={MEMBER_STATUS_LABEL[member.status]}
                        tone={MEMBER_STATUS_TONE[member.status]}
                      />
                    </View>
                    <View style={styles.badges}>
                      {member.isCurrentUser ? (
                        <Badge label={t('team.you')} tone="blue" />
                      ) : null}
                      {member.isOwner ? (
                        <Badge label={t('team.owner')} tone="green" />
                      ) : null}
                      {main ? (
                        <Badge label={COMPANY_ROLE_LABELS[main]} tone="slate" />
                      ) : null}
                    </View>
                    <Text variant="small" color={colors.textMuted}>
                      {member.isOwner
                        ? t('team.fullAccess')
                        : main
                        ? COMPANY_ROLE_DESCRIPTIONS[main]
                        : ''}
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      {member.lastLoginAt
                        ? t('team.lastActive', {
                            time: formatDateTime(member.lastLoginAt),
                          })
                        : t('team.neverSignedIn')}
                    </Text>
                    {hasActions ? (
                      <Button
                        label={t('team.manage')}
                        size="sm"
                        variant="outline"
                        onPress={() => setActing(member)}
                        testID={`member-${member.membershipId}-manage`}
                      />
                    ) : null}
                  </Card>
                );
              })}

              {role.canManageTeam ? (
                <>
                  <SectionTitle>{t('team.invitations')}</SectionTitle>
                  <LoadGate query={invitations}>
                    {list =>
                      list.length === 0 ? (
                        <EmptyState icon="mail" title={t('team.noInvites')} />
                      ) : (
                        <>
                          {list.map(invitation => (
                            <Card
                              key={invitation.id}
                              style={styles.card}
                              testID={`invite-${invitation.id}`}
                            >
                              <View style={styles.head}>
                                <View style={styles.flex}>
                                  <Text variant="cardTitle">
                                    {invitation.email}
                                  </Text>
                                  <Text
                                    variant="small"
                                    color={colors.textMuted}
                                  >
                                    {invitation.roles
                                      .map(item => COMPANY_ROLE_LABELS[item])
                                      .join(', ')}
                                  </Text>
                                </View>
                                <StatusBadge
                                  status={
                                    INVITATION_STATUS_LABEL[invitation.status]
                                  }
                                  tone={
                                    INVITATION_STATUS_TONE[invitation.status]
                                  }
                                />
                              </View>
                              <Text variant="small" color={colors.textMuted}>
                                {invitation.status === 'INVITED'
                                  ? t('team.expires', {
                                      date: formatFullDate(
                                        invitation.expiresAt,
                                      ),
                                    })
                                  : t('team.sent', {
                                      date: formatFullDate(
                                        invitation.lastSentAt,
                                      ),
                                    })}
                              </Text>
                              {invitationOpen(invitation) ? (
                                <View style={styles.actions}>
                                  <Button
                                    label={t('team.resend')}
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onPress={() => {
                                      void resend(invitation);
                                    }}
                                    testID={`invite-${invitation.id}-resend`}
                                  />
                                  <Button
                                    label={t('team.revoke')}
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onPress={() =>
                                      setPending({ kind: 'revoke', invitation })
                                    }
                                    testID={`invite-${invitation.id}-revoke`}
                                  />
                                </View>
                              ) : null}
                            </Card>
                          ))}
                        </>
                      )
                    }
                  </LoadGate>
                </>
              ) : null}

              {/* What can be done to one member. */}
              <BottomSheet
                visible={acting !== null}
                onClose={() => setActing(null)}
                title={acting?.fullName ?? acting?.email ?? ''}
              >
                {acting ? (
                  <View style={styles.sheet}>
                    {(() => {
                      const actions = memberActions(me, acting);
                      const open = (
                        kind: 'disable' | 'enable' | 'remove' | 'transfer',
                      ) => {
                        setPending({ kind, member: acting });
                        setActing(null);
                      };
                      return (
                        <>
                          {actions.editRole ? (
                            <Button
                              label={t('team.editRole')}
                              variant="outline"
                              onPress={() => {
                                setRolePick(acting);
                                setChosen(primaryRole(acting.companyRoles));
                                setActing(null);
                              }}
                              testID="member-edit-role"
                            />
                          ) : null}
                          {actions.disable ? (
                            <Button
                              label={t('team.disable')}
                              variant="outline"
                              onPress={() => open('disable')}
                              testID="member-disable"
                            />
                          ) : null}
                          {actions.enable ? (
                            <Button
                              label={t('team.enable')}
                              variant="outline"
                              onPress={() => open('enable')}
                              testID="member-enable"
                            />
                          ) : null}
                          {actions.transfer ? (
                            <Button
                              label={t('team.transfer')}
                              variant="outline"
                              onPress={() => open('transfer')}
                              testID="member-transfer"
                            />
                          ) : null}
                          {actions.remove ? (
                            <Button
                              label={t('team.remove')}
                              variant="danger"
                              onPress={() => open('remove')}
                              testID="member-remove"
                            />
                          ) : null}
                        </>
                      );
                    })()}
                  </View>
                ) : null}
              </BottomSheet>

              <BottomSheet
                visible={rolePick !== null}
                onClose={() => setRolePick(null)}
                title={t('team.editRole')}
                scrollable
              >
                <View style={styles.sheet}>
                  <Text variant="meta" color={colors.textMuted}>
                    {t('team.roleSignOut')}
                  </Text>
                  {roleOptionsFor(me).map(option => (
                    <ChoiceRow
                      key={option}
                      label={COMPANY_ROLE_LABELS[option]}
                      description={COMPANY_ROLE_DESCRIPTIONS[option]}
                      selected={chosen === option}
                      onPress={() => setChosen(option)}
                    />
                  ))}
                  <Button
                    label={t('form.save')}
                    onPress={() => {
                      void saveRole();
                    }}
                    loading={busy}
                    disabled={busy || !chosen}
                    testID="member-role-save"
                  />
                </View>
              </BottomSheet>
            </>
          );
        }}
      </LoadGate>

      <ConfirmDialog
        visible={pending !== null && copy !== null}
        title={copy?.title ?? ''}
        message={copy?.message}
        confirmLabel={copy?.label ?? t('common.confirm')}
        cancelLabel={t('common.cancel')}
        destructive={pending?.kind !== 'enable'}
        loading={busy}
        onConfirm={() => {
          void confirm();
        }}
        onCancel={() => setPending(null)}
      />
      <InviteLinkSheet
        token={link?.token ?? null}
        email={link?.email ?? ''}
        emailSent={link?.emailSent ?? false}
        onClose={() => setLink(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  flex: { flex: 1 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  sheet: { gap: spacing.md, padding: spacing.lg },
});
