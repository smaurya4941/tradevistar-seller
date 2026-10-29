/**
 * The More tab: every area of the web portal that is not one of the main tabs, grouped like the
 * web sidebar, plus Help and about, Diagnostics (dev and staging builds only) and sign out.
 * Entries show the same unread badges as the web sidebar.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import { track } from '@/core/analytics/analytics';
import { useLiveSnapshot } from '@/core/realtime/liveSnapshot';
import {
  Card,
  ConfirmDialog,
  Divider,
  ListRow,
  SectionTitle,
  spacing,
} from '@/design';
import { badgeCounts } from '@tradevistar/seller-api';
import { useT } from '@/i18n';
import { TabScreen } from '../components/TabScreen';
import { SECTION_BADGE } from '../navigation/moreBadges';
import { openRoute } from '../navigation/openHref';
import { routeForSection } from '../navigation/routeMapping';
import { MORE_GROUPS, type SectionId } from '../navigation/sections';
import type { MoreStackParamList } from '../navigation/types';

export function MoreScreen() {
  const t = useT();
  const engine = useSessionEngine();
  const navigation =
    useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const counts = useLiveSnapshot(snapshot => badgeCounts(snapshot));
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    track('signout', { reason: 'user' });
    await engine.signOut();
    // The session state flips to signedOut and the navigator swaps to SignIn; nothing to reset.
  };

  const open = (id: SectionId) => {
    const route = routeForSection(id);
    // Entries with a real screen of their own open in this tab's stack; the rest open a section.
    if (route.name === 'Section') {
      navigation.navigate('Section', { sectionId: id });
    } else if (route.name === 'Shared') {
      (navigation.navigate as (name: string, params?: object) => void)(
        route.params.screen,
        route.params.params,
      );
    } else {
      openRoute(route);
    }
  };

  return (
    <TabScreen title={t('more.title')} testID="screen-more">
      {MORE_GROUPS.map(group => (
        <View key={group.id} style={styles.group}>
          <SectionTitle>{t(group.labelKey)}</SectionTitle>
          <Card style={styles.card}>
            {group.items.map((item, index) => {
              const badgeKey = SECTION_BADGE[item.id];
              return (
                <React.Fragment key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    testID={`more-${item.id}`}
                    label={t(item.labelKey)}
                    icon={item.icon}
                    badge={badgeKey && counts ? counts[badgeKey] : 0}
                    onPress={() => open(item.id)}
                  />
                </React.Fragment>
              );
            })}
          </Card>
        </View>
      ))}

      <Card style={styles.card}>
        <ListRow
          testID="more-help-about"
          label={t('more.item.helpAbout')}
          icon="help"
          onPress={() => navigation.navigate('HelpAbout')}
        />
        <Divider />
        {env.diagnosticsEnabled ? (
          <>
            <ListRow
              testID="more-diagnostics"
              label={t('more.item.diagnostics')}
              icon="bug_report"
              onPress={() => navigation.navigate('Diagnostics')}
            />
            <Divider />
          </>
        ) : null}
        <ListRow
          testID="more-sign-out"
          label={t('more.signOut')}
          icon="logout"
          destructive
          trailingIcon={null}
          onPress={() => setConfirmingSignOut(true)}
        />
      </Card>

      <ConfirmDialog
        visible={confirmingSignOut}
        title={t('more.signOut.title')}
        message={t('more.signOut.body')}
        confirmLabel={t('more.signOut')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          void signOut();
        }}
        testID="sign-out-dialog"
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  card: { gap: 0, paddingVertical: spacing.xs },
});
