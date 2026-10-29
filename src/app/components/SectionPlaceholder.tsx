/**
 * A signed-in area whose screens arrive in a later phase: what the section will hold, and the
 * same section on the web portal in the meantime, so the seller is never stuck.
 */
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import {
  Button,
  Card,
  colors,
  Icon,
  palette,
  radii,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';

export function SectionPlaceholder({
  icon,
  title,
  body,
  webPath,
  testID,
}: {
  icon: string;
  title: string;
  body: string;
  /** The seller web portal page for this section, e.g. /seller/dashboard/orders. */
  webPath?: string;
  testID?: string;
}) {
  const t = useT();
  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name={icon} size={24} color={palette.orange} />
        </View>
        <Text
          variant="cardTitle"
          style={styles.flex}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      <Text variant="body" color={colors.textMuted}>
        {body}
      </Text>
      {webPath ? (
        <Button
          label={t('common.openInBrowser')}
          icon="open_in_new"
          variant="outline"
          onPress={() => {
            void Linking.openURL(`${env.webUrl}${webPath}`);
          }}
          fullWidth
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.orange50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
