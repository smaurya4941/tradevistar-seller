/** A one-line notice on a screen: an icon and short text (e.g. "Updated 5 min ago"). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, Icon, radii, spacing, Text } from '@/design';

export function ActivityNote({
  icon,
  text,
  testID,
}: {
  icon: string;
  text: string;
  testID?: string;
}) {
  return (
    <View
      style={styles.note}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text variant="small" color={colors.textMuted}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
});
