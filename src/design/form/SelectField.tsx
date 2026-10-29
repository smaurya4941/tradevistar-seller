import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { BottomSheet } from '../components/BottomSheet';
import { ChoiceRow } from '../components/Controls';
import { Input } from '../components/Field';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { colors, HIT_TARGET, radii, spacing } from '../tokens';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectFieldProps {
  label: string;
  value: string | null | undefined;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  /** Adds a search box (countries, states, cities). */
  searchable?: boolean;
  /** Adds a "Not specified" row that clears the value. */
  clearable?: boolean;
  disabled?: boolean;
  /** Shown while the options are loading. */
  loading?: boolean;
  testID?: string;
}

/**
 * A field that opens a bottom sheet of choices. Long lists (countries, states, cities) get a
 * search box; the sheet is the only place the options render, so a screen with several selects
 * stays light.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  searchable = false,
  clearable = false,
  disabled = false,
  loading = false,
  testID,
}: SelectFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const shown = selected?.label ?? (value ? value : '');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter(option => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text
        variant="label"
        color={colors.onSurfaceVariant}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${
          shown || placeholder || t('form.choose')
        }${error ? `, ${error}` : ''}`}
        style={[
          styles.box,
          error ? styles.boxError : null,
          disabled ? styles.boxDisabled : null,
        ]}
      >
        <Text
          variant="body"
          color={shown ? colors.onSurface : colors.outline}
          style={styles.value}
          numberOfLines={1}
        >
          {shown || placeholder || t('form.choose')}
        </Text>
        <Icon name="expand_more" size={22} color={colors.outline} />
      </Pressable>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="error" size={16} color={colors.error} />
          <Text variant="small" color={colors.error} style={styles.value}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={close} title={label}>
        {searchable ? (
          <View style={styles.search}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('form.search')}
              leadingIcon="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={t('form.search')}
            />
          </View>
        ) : null}
        {loading ? (
          <Text variant="meta" color={colors.textMuted} style={styles.empty}>
            {t('common.loading')}
          </Text>
        ) : (
          <FlatList
            style={styles.list}
            data={filtered}
            keyExtractor={option => option.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListHeaderComponent={
              clearable && !query ? (
                <ChoiceRow
                  label={t('form.notSpecified')}
                  selected={!value}
                  onPress={() => {
                    onChange('');
                    close();
                  }}
                />
              ) : undefined
            }
            ListEmptyComponent={
              <Text
                variant="meta"
                color={colors.textMuted}
                style={styles.empty}
              >
                {t('form.noResults', { query })}
              </Text>
            }
            renderItem={({ item }) => (
              <ChoiceRow
                label={item.label}
                description={item.description}
                selected={item.value === value}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
              />
            )}
            ItemSeparatorComponent={Gap}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  box: {
    minHeight: HIT_TARGET + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boxError: { borderColor: colors.error, borderWidth: 1.5 },
  boxDisabled: { backgroundColor: colors.surfaceContainer },
  value: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { maxHeight: 420, paddingHorizontal: spacing.lg },
  empty: { padding: spacing.lg, textAlign: 'center' },
  gap: { height: spacing.sm },
});
