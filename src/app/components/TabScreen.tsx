/**
 * The frame for every tab: a title bar under the status bar, safe-area handling, and a scrolling
 * body with optional pull-to-refresh.
 */
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, Text } from '@/design';

export function TabScreen({
  title,
  right,
  children,
  onRefresh,
  refreshing = false,
  testID,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  testID?: string;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.root} testID={testID}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text
          variant="h1"
          color={colors.secondary}
          accessibilityRole="header"
          style={styles.title}
        >
          {title}
        </Text>
        {right}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
});
