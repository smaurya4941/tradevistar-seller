/**
 * Four shortcuts into the work a seller does most. Each opens the matching area (a placeholder
 * until Phases 5 and 6 build the screens). Export Catalog (needs the Phase 5 product list) and
 * Share Storefront (the web copies the seller portal's own address, not a storefront link) are
 * left out on purpose.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import type { AppRoute } from '@/app/navigation/types';
import {
  Card,
  colors,
  HIT_TARGET,
  Icon,
  palette,
  radii,
  spacing,
  Text,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';

interface Action {
  key: string;
  label: TranslationKey;
  icon: string;
  route: AppRoute;
}

const ACTIONS: Action[] = [
  {
    key: 'upload',
    label: 'home.quick.upload',
    icon: 'upload_file',
    route: {
      name: 'Main',
      params: { screen: 'Products', query: { action: 'upload' } },
    },
  },
  {
    key: 'add',
    label: 'home.quick.add',
    icon: 'add_box',
    route: {
      name: 'Main',
      params: { screen: 'Products', query: { action: 'add' } },
    },
  },
  {
    key: 'quote',
    label: 'home.quick.quote',
    icon: 'request_quote',
    route: { name: 'Section', params: { sectionId: 'quotations' } },
  },
  {
    key: 'rfq',
    label: 'home.quick.rfq',
    icon: 'contact_support',
    route: { name: 'Section', params: { sectionId: 'inquiries' } },
  },
];

export function QuickActions() {
  const t = useT();
  return (
    <Card testID="quick-actions">
      <Text variant="section" accessibilityRole="header">
        {t('home.quick.title')}
      </Text>
      <View style={styles.grid}>
        {ACTIONS.map(action => (
          <Pressable
            key={action.key}
            testID={`quick-${action.key}`}
            accessibilityRole="button"
            accessibilityLabel={t(action.label)}
            onPress={() => openRoute(action.route)}
            style={({ pressed }) => [
              styles.action,
              pressed && { backgroundColor: colors.surfaceContainer },
            ]}
          >
            <View style={styles.icon}>
              <Icon name={action.icon} size={22} color={palette.orange600} />
            </View>
            <Text variant="label" numberOfLines={2} style={styles.label}>
              {t(action.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: HIT_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.orange50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
