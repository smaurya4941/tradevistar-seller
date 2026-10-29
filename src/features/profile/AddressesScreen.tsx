/**
 * Business addresses: one list with purpose chips (registered, operating, billing, pickup,
 * warehouse, return). Each card shows where it is, who to call, whether it is the default for its
 * purpose and whether it has an exact map pin. Warehouse and pickup addresses are mirrored into
 * warehouses on the server (Phase 5 inventory).
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  ADDRESS_PURPOSE_LABELS,
  ADDRESS_PURPOSES,
  deleteCompanyAddress,
  googleMapsUrl,
  pinStatusKey,
  updateCompanyAddress,
  type AddressPurpose,
  type CompanyAddressView,
} from '@tradevistar/seller-api';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import {
  Badge,
  Banner,
  Button,
  Card,
  ChipRow,
  colors,
  ConfirmDialog,
  EmptyState,
  Icon,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import { companyKeys, useAddresses, useUpdatedLabel } from './data';
import { profileErrorMessage } from './errors';

type Nav = NativeStackNavigationProp<SharedScreens>;

const PIN_KEY: Record<ReturnType<typeof pinStatusKey>, TranslationKey> = {
  gps: 'addr.pin.gps',
  map: 'addr.pin.map',
  geocoded: 'addr.pin.geocoded',
  none: 'addr.pin.none',
};

export function AddressesScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'Addresses'>>();
  const toast = useToast();
  const client = useQueryClient();
  const query = useAddresses();
  const updated = useUpdatedLabel(query);
  const [filter, setFilter] = useState<AddressPurpose | 'ALL'>(
    route.params?.purpose ?? 'ALL',
  );
  const [removing, setRemoving] = useState<CompanyAddressView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: companyKeys.addresses }),
      client.invalidateQueries({ queryKey: companyKeys.overview }),
    ]);

  const chips = useMemo(
    () => [
      { value: 'ALL', label: t('addr.all') },
      ...ADDRESS_PURPOSES.map(value => ({
        value,
        label: ADDRESS_PURPOSE_LABELS[value],
      })),
    ],
    [t],
  );

  const makeDefault = async (address: CompanyAddressView) => {
    setBusy(address.id);
    try {
      await updateCompanyAddress(address.id, {
        isDefault: true,
        version: address.version,
      });
      await refresh();
      toast.show(t('addr.defaultSet'), 'success');
    } catch (error) {
      void refresh();
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await deleteCompanyAddress(removing.id);
      await refresh();
      toast.show(t('addr.removed'), 'success');
    } catch (error) {
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(null);
      setRemoving(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-addresses"
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isPending}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <LoadGate query={query} updatedLabel={updated}>
        {all => {
          const list = all.filter(
            address =>
              address.isActive &&
              (filter === 'ALL' || address.purpose === filter),
          );
          return (
            <>
              <ChipRow
                options={chips}
                value={filter}
                onChange={value => setFilter(value as AddressPurpose | 'ALL')}
                testID="addr-filter"
              />
              {list.length === 0 ? (
                <EmptyState
                  icon="location_off"
                  title={t('addr.emptyTitle')}
                  message={t('addr.emptyBody')}
                />
              ) : (
                list.map(address => (
                  <Card
                    key={address.id}
                    style={styles.card}
                    testID={`addr-${address.id}`}
                  >
                    <View style={styles.head}>
                      <Icon
                        name="location_on"
                        size={22}
                        color={colors.secondary}
                      />
                      <View style={styles.flex}>
                        <Text variant="cardTitle">
                          {address.label ||
                            ADDRESS_PURPOSE_LABELS[address.purpose]}
                        </Text>
                        <Text variant="small" color={colors.textMuted}>
                          {ADDRESS_PURPOSE_LABELS[address.purpose]}
                        </Text>
                      </View>
                      {address.isDefault ? (
                        <Badge label={t('addr.default')} tone="green" />
                      ) : null}
                    </View>
                    <Text variant="body">
                      {[
                        address.line1,
                        address.line2,
                        address.city,
                        address.state,
                        address.zip,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      {address.contactName} · {address.phone}
                    </Text>
                    <View style={styles.pinRow}>
                      <Icon
                        name={
                          address.latitude !== null ? 'place' : 'wrong_location'
                        }
                        size={16}
                        color={
                          address.latitude !== null
                            ? colors.success
                            : colors.warning
                        }
                      />
                      <Text
                        variant="small"
                        color={colors.onSurfaceVariant}
                        style={styles.flex}
                      >
                        {t(PIN_KEY[pinStatusKey(address.locationSource)])}
                      </Text>
                      {address.latitude !== null &&
                      address.longitude !== null ? (
                        <Button
                          label={t('addr.openMaps')}
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            void Linking.openURL(
                              googleMapsUrl(
                                address.latitude as number,
                                address.longitude as number,
                              ),
                            );
                          }}
                          testID={`addr-${address.id}-maps`}
                        />
                      ) : null}
                    </View>
                    <View style={styles.actions}>
                      <Button
                        label={t('form.edit')}
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          navigation.navigate('AddressForm', {
                            addressId: address.id,
                          })
                        }
                        testID={`addr-${address.id}-edit`}
                      />
                      {!address.isDefault ? (
                        <Button
                          label={t('addr.makeDefault')}
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onPress={() => {
                            void makeDefault(address);
                          }}
                          testID={`addr-${address.id}-default`}
                        />
                      ) : null}
                      <Button
                        label={t('form.remove')}
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onPress={() => setRemoving(address)}
                        testID={`addr-${address.id}-remove`}
                      />
                    </View>
                  </Card>
                ))
              )}
              <Banner tone="blue" message={t('addr.warehouseNote')} />
              <Button
                label={t('addr.add')}
                icon="add"
                onPress={() =>
                  navigation.navigate('AddressForm', {
                    purpose: filter === 'ALL' ? undefined : filter,
                  })
                }
                testID="addr-add"
              />
            </>
          );
        }}
      </LoadGate>
      <ConfirmDialog
        visible={removing !== null}
        title={t('addr.remove.title')}
        message={t('addr.remove.body')}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy !== null}
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => setRemoving(null)}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
