/**
 * A tappable field that opens a searchable list in a sheet: the business country and category on
 * the registration form. The options come from a query the caller supplies, loaded when the sheet
 * first opens.
 */
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  colors,
  HIT_TARGET,
  Icon,
  Input,
  radii,
  spacing,
  Text,
} from '@/design';
import { useT } from '@/i18n';

export interface PickerOption {
  value: string;
  label: string;
}

export function OptionPicker({
  label,
  placeholder,
  title,
  selectedLabel,
  selectedValue,
  queryKey,
  load,
  onSelect,
  allowClear,
  error,
  testID,
}: {
  label: string;
  placeholder: string;
  title: string;
  selectedLabel: string;
  selectedValue: string;
  queryKey: readonly unknown[];
  load: (signal?: AbortSignal) => Promise<PickerOption[]>;
  onSelect: (option: PickerOption | null) => void;
  /** Offers "No category selected" at the top of the list. */
  allowClear?: boolean;
  error?: string | null;
  testID: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const options = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = list.data ?? [];
    return needle
      ? all.filter(option => option.label.toLowerCase().includes(needle))
      : all;
  }, [list.data, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.root}>
      <Text variant="label" color={colors.onSurfaceVariant}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel || placeholder}`}
        style={[styles.box, error ? styles.boxInvalid : null]}
        testID={testID}
      >
        <Text
          variant="body"
          color={selectedLabel ? colors.onSurface : colors.outline}
          style={styles.flex}
          numberOfLines={1}
        >
          {selectedLabel || placeholder}
        </Text>
        <Icon name="expand_more" size={22} color={colors.outline} />
      </Pressable>
      {error ? (
        <Text variant="small" color={colors.error}>
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={close} title={title}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder={t('register.business.search')}
          leadingIcon="search"
          autoCorrect={false}
          autoCapitalize="none"
          testID={`${testID}-search`}
        />
        {list.isError ? (
          <View style={styles.state}>
            <Text variant="body" color={colors.error}>
              {t('register.business.listFailed')}
            </Text>
            <Button
              label={t('common.tryAgain')}
              variant="outline"
              size="sm"
              onPress={() => {
                void list.refetch();
              }}
            />
          </View>
        ) : list.isLoading ? (
          <View style={styles.state}>
            <Text variant="body" color={colors.textMuted}>
              {t('common.loading')}
            </Text>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={options}
            keyExtractor={option => option.value}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowClear && !search ? (
                <Row
                  label={t('register.business.categoryNone')}
                  selected={!selectedValue}
                  onPress={() => {
                    onSelect(null);
                    close();
                  }}
                />
              ) : undefined
            }
            ListEmptyComponent={
              <Text variant="body" color={colors.textMuted}>
                {t('register.business.noResults')}
              </Text>
            }
            renderItem={({ item }) => (
              <Row
                label={item.label}
                selected={item.value === selectedValue}
                onPress={() => {
                  onSelect(item);
                  close();
                }}
              />
            )}
          />
        )}
      </BottomSheet>
    </View>
  );
}

function Row({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.row}
    >
      <Text variant={selected ? 'bodyStrong' : 'body'} style={styles.flex}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs + 2 },
  flex: { flex: 1 },
  box: {
    minHeight: HIT_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  boxInvalid: { borderColor: colors.error },
  list: { maxHeight: 360, marginTop: spacing.sm },
  row: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  state: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'flex-start',
  },
});
