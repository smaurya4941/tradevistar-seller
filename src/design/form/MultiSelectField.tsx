import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Controls';
import { Input } from '../components/Field';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { colors, HIT_TARGET, radii, spacing } from '../tokens';
import type { SelectOption } from './SelectField';

export interface MultiSelectFieldProps {
  label: string;
  values: readonly string[];
  options: readonly SelectOption[];
  onChange: (values: string[]) => void;
  /** At most this many may be chosen. */
  max: number;
  placeholder?: string;
  error?: string | null;
  searchable?: boolean;
  loading?: boolean;
  testID?: string;
}

/** A field that opens a sheet of checkable rows (secondary categories, export countries). */
export function MultiSelectField({
  label,
  values,
  options,
  onChange,
  max,
  placeholder,
  error,
  searchable = true,
  loading = false,
  testID,
}: MultiSelectFieldProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>([]);

  const labelOf = useMemo(
    () => new Map(options.map(option => [option.value, option.label])),
    [options],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter(option => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, query]);

  const summary =
    values.length === 0
      ? placeholder ?? t('form.choose')
      : values.length <= 3
      ? values.map(value => labelOf.get(value) ?? value).join(', ')
      : t('form.selectedCount', { count: values.length });

  const show = () => {
    setDraft([...values]);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const toggle = (value: string) =>
    setDraft(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : current.length >= max
        ? current
        : [...current, value],
    );

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
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${summary}`}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text
          variant="body"
          color={values.length ? colors.onSurface : colors.outline}
          style={styles.flex}
          numberOfLines={2}
        >
          {summary}
        </Text>
        <Icon name="expand_more" size={22} color={colors.outline} />
      </Pressable>
      {error ? (
        <Text
          variant="small"
          color={colors.error}
          accessibilityLiveRegion="polite"
        >
          {error}
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
            />
          </View>
        ) : null}
        <Text variant="small" color={colors.textMuted} style={styles.count}>
          {t('form.selectLimit', { count: draft.length, max })}
        </Text>
        {loading ? (
          <Text variant="meta" color={colors.textMuted} style={styles.count}>
            {t('common.loading')}
          </Text>
        ) : (
          <FlatList
            style={styles.list}
            data={filtered}
            keyExtractor={option => option.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => (
              <Checkbox
                checked={draft.includes(item.value)}
                onChange={() => toggle(item.value)}
                accessibilityLabel={item.label}
              >
                <Text variant="body">{item.label}</Text>
              </Checkbox>
            )}
            ListEmptyComponent={
              <Text
                variant="meta"
                color={colors.textMuted}
                style={styles.count}
              >
                {t('form.noResults', { query })}
              </Text>
            }
          />
        )}
        <View style={styles.footer}>
          <Button
            label={t('form.done')}
            onPress={() => {
              onChange(draft);
              close();
            }}
            testID={testID ? `${testID}-done` : undefined}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: spacing.xs + 2 },
  box: {
    minHeight: HIT_TARGET + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boxError: { borderColor: colors.error, borderWidth: 1.5 },
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  count: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { maxHeight: 380, paddingHorizontal: spacing.lg },
  footer: { padding: spacing.lg },
});
