import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../theme';
import { HIT_TARGET, radii, spacing } from '../tokens';
import { Text } from './Text';

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  /** A count shown after the label, e.g. orders waiting. Hidden at zero. */
  count?: number;
}

export interface SegmentedTabsProps<K extends string> {
  tabs: readonly SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  testID?: string;
}

/** Status tabs for lists (All, To ship, Shipped…): scrolls sideways when they do not fit. */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  testID,
}: SegmentedTabsProps<K>) {
  const colors = useThemeColors();
  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        {tabs.map(tab => {
          const selected = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                tab.count ? `${tab.label}, ${tab.count}` : tab.label
              }
              testID={testID ? `${testID}-${tab.key}` : undefined}
              style={[
                styles.tab,
                {
                  backgroundColor: selected
                    ? colors.secondary
                    : colors.surfaceContainer,
                },
              ]}
            >
              <Text
                variant="label"
                color={selected ? colors.onSecondary : colors.onSurfaceVariant}
              >
                {tab.label}
              </Text>
              {tab.count ? (
                <Text
                  variant="badge"
                  color={selected ? colors.onSecondary : colors.textMuted}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  tab: {
    minHeight: HIT_TARGET - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
});
