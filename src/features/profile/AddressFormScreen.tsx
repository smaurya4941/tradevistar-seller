/**
 * Add or edit a business address, with the map pin rules the web follows:
 * - a pin set in this form stays when the address text is corrected;
 * - a previously saved pin is dropped when the address text changes (it described the old text);
 * - `locationSource` is sent only for a pin set in this session;
 * - after saving a pickup, warehouse or registered address with no pin, the seller is warned that
 *   the courier cannot collect from it.
 * Pin options: use my current location (GPS, with its accuracy), set the pin on a map (hidden when
 * the build has no Maps key), and find from the typed address (only an EXACT match is offered).
 */
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import {
  ADDRESS_PURPOSE_LABELS,
  ADDRESS_PURPOSES,
  addressPatchFromGeocode,
  addressPayload,
  canGeocode,
  createCompanyAddress,
  emptyAddressForm,
  formFromAddress,
  geocodeAddress,
  hasPin,
  isStaleVersion,
  LocationError,
  missingPinWarning,
  NO_PIN,
  pinAfterEdit,
  pinFromAddress,
  pinFromCapture,
  pinFromGeocode,
  reverseGeocodeLocation,
  updateCompanyAddress,
  validateAddress,
  type AddressForm,
  type AddressPurpose,
  type PinState,
} from '@tradevistar/seller-api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '@/config/env';
import type { SharedScreens } from '@/app/navigation/types';
import { openLocationSettings } from '@/core/native/currentLocation';
import { serverFieldErrors } from '@/core/forms/serverErrors';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import {
  Banner,
  Button,
  colors,
  Field,
  FormScreen,
  FormSection,
  Icon,
  PhoneField,
  SelectField,
  SwitchRow,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { LoadGate } from './components/LoadGate';
import {
  companyKeys,
  useAddresses,
  useCities,
  useCountries,
  useStates,
} from './data';
import { profileErrorMessage } from './errors';
import { clearMapBridge, setMapRequest, takeMapResult } from './mapPinBridge';
import {
  FAILURE_MESSAGE,
  locationFailureOf,
  useLocationCapture,
} from './useLocationCapture';

type Nav = NativeStackNavigationProp<SharedScreens>;

export function AddressFormScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SharedScreens, 'AddressForm'>>();
  const toast = useToast();
  const client = useQueryClient();
  const addressId = route.params?.addressId;
  const query = useAddresses();
  const existing = useMemo(
    () => query.data?.find(item => item.id === addressId) ?? null,
    [query.data, addressId],
  );

  const [form, setForm] = useState<AddressForm>(() =>
    emptyAddressForm(route.params?.purpose ?? 'OPERATING'),
  );
  const [pin, setPin] = useState<PinState>(NO_PIN);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(!addressId);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [pinNotice, setPinNotice] = useState<{
    tone: 'blue' | 'amber' | 'red';
    text: string;
    settings?: boolean;
  } | null>(null);
  const [finding, setFinding] = useState(false);
  const { locating, capture } = useLocationCapture();
  const { allowLeave } = useUnsavedGuard(dirty && !saving);

  // An edit starts from the saved address, once.
  useEffect(() => {
    if (loaded || !existing) return;
    setForm(formFromAddress(existing));
    setPin(pinFromAddress(existing));
    setLoaded(true);
  }, [existing, loaded]);

  const countries = useCountries();
  const states = useStates(form.countryCode);
  const stateCode =
    form.stateCode ||
    states.data?.find(
      item => item.name.toLowerCase() === form.state.toLowerCase(),
    )?.code ||
    '';
  const cities = useCities(form.countryCode, stateCode);

  const change = useCallback(
    <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => {
      setForm(current => ({ ...current, [key]: value }));
      setPin(current => pinAfterEdit(current, key));
      setDirty(true);
      setPinNotice(null);
      setError(null);
    },
    [],
  );

  // The pin map hands its choice back through the bridge when this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      const picked = takeMapResult();
      if (!picked) return;
      setPin(pinFromCapture(picked.lat, picked.lng, 'MAP_PIN'));
      setAccuracy(null);
      setDirty(true);
      setPinNotice({ tone: 'blue', text: t('pin.set') });
      // The address at the pin fills only what is still empty; typed text is never overwritten.
      reverseGeocodeLocation(picked.lat, picked.lng)
        .then(found => {
          const patch = addressPatchFromGeocode(found);
          setForm(current => ({
            ...current,
            line1: current.line1.trim()
              ? current.line1
              : patch.line1 ?? current.line1,
            city: current.city.trim()
              ? current.city
              : patch.city ?? current.city,
            state: current.state.trim()
              ? current.state
              : patch.state ?? current.state,
            zip: current.zip.trim() ? current.zip : patch.zip ?? current.zip,
          }));
        })
        .catch(() => undefined);
    }, [t]),
  );
  useEffect(() => () => clearMapBridge(), []);

  const captureHere = async () => {
    setPinNotice(null);
    try {
      const result = await capture();
      if (!result) return;
      setPin(
        pinFromCapture(result.point.latitude, result.point.longitude, 'GPS'),
      );
      setAccuracy(result.accuracy);
      setForm(current => ({
        ...current,
        line1:
          current.line1.trim() || !result.patch.line1
            ? current.line1
            : result.patch.line1,
        city:
          current.city.trim() || !result.patch.city
            ? current.city
            : result.patch.city,
        state:
          current.state.trim() || !result.patch.state
            ? current.state
            : result.patch.state,
        zip:
          current.zip.trim() || !result.patch.zip
            ? current.zip
            : result.patch.zip,
      }));
      setDirty(true);
      setPinNotice({
        tone: 'blue',
        text: result.filled ? t('loc.filled') : t('loc.capturedOnly'),
      });
    } catch (caught) {
      const reason = locationFailureOf(caught);
      setPinNotice({
        tone: 'red',
        text: t(FAILURE_MESSAGE[reason]),
        settings: caught instanceof LocationError && reason === 'denied',
      });
    }
  };

  const openMap = () => {
    setMapRequest({
      pin: hasPin(pin)
        ? { lat: pin.latitude as number, lng: pin.longitude as number }
        : null,
      address: {
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        countryCode: form.countryCode,
      },
    });
    navigation.navigate('MapPin');
  };

  const findFromAddress = async () => {
    if (!canGeocode(form)) {
      setPinNotice({ tone: 'amber', text: t('addr.find.needAddress') });
      return;
    }
    setFinding(true);
    setPinNotice(null);
    try {
      const found = await geocodeAddress({
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        countryCode: form.countryCode,
      });
      if (found.precision === 'EXACT') {
        setPin(pinFromGeocode(found.lat, found.lng));
        setAccuracy(null);
        setDirty(true);
        setPinNotice({ tone: 'blue', text: t('addr.find.exact') });
      } else {
        // Only an exact match is ever offered as a pin; an area match just says so.
        setPinNotice({ tone: 'amber', text: t('pin.hintArea') });
      }
    } catch {
      setPinNotice({ tone: 'amber', text: t('addr.find.failed') });
    } finally {
      setFinding(false);
    }
  };

  const errors = useMemo(() => validateAddress(form), [form]);
  const shown = (name: keyof AddressForm) =>
    (showErrors ? errors[name] : undefined) ?? serverErrors[name];

  const save = async () => {
    setShowErrors(true);
    setServerErrors({});
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const body = addressPayload(form, pin, existing?.version);
      if (existing) await updateCompanyAddress(existing.id, body);
      else await createCompanyAddress(body);
      await Promise.all([
        client.invalidateQueries({ queryKey: companyKeys.addresses }),
        client.invalidateQueries({ queryKey: companyKeys.overview }),
      ]);
      allowLeave();
      navigation.goBack();
      if (missingPinWarning(form.purpose, pin)) {
        toast.show(t('addr.noPinWarning'), 'info');
      } else {
        toast.show(t('form.saved'), 'success');
      }
    } catch (caught) {
      if (isStaleVersion(caught)) {
        await query.refetch();
        setStale(true);
      } else {
        setServerErrors(serverFieldErrors(caught));
        setError(profileErrorMessage(caught, t));
      }
    } finally {
      setSaving(false);
    }
  };

  const purposeOptions = useMemo(
    () =>
      ADDRESS_PURPOSES.map(value => ({
        value,
        label: ADDRESS_PURPOSE_LABELS[value],
      })),
    [],
  );
  const countryOptions = useMemo(
    () =>
      (countries.data ?? []).map(country => ({
        value: country.code,
        label: country.name,
      })),
    [countries.data],
  );
  const stateOptions = useMemo(
    () =>
      (states.data ?? []).map(item => ({ value: item.code, label: item.name })),
    [states.data],
  );
  const cityOptions = useMemo(
    () =>
      (cities.data ?? []).map(item => ({ value: item.name, label: item.name })),
    [cities.data],
  );

  const showMap = env.mapsEnabled;
  const locationNote: TranslationKey = pin.setNow
    ? 'addr.pin.setNow'
    : hasPin(pin)
    ? 'addr.pin.saved'
    : 'addr.pin.none';

  const body = (
    <>
      {stale ? (
        <Banner
          tone="amber"
          message={t('form.staleReview')}
          testID="stale-notice"
        />
      ) : null}
      {error ? <Banner tone="red" message={error} testID="addr-error" /> : null}

      <FormSection title={t('addr.section.where')}>
        <SelectField
          label={t('addr.purpose')}
          value={form.purpose}
          options={purposeOptions}
          onChange={value => change('purpose', value as AddressPurpose)}
          testID="addr-purpose"
        />
        <Field
          label={t('addr.label')}
          hint={t('form.optional')}
          value={form.label}
          onChangeText={value => change('label', value)}
          maxLength={50}
          error={shown('label')}
        />
        <Field
          label={t('addr.contact')}
          value={form.contactName}
          onChangeText={value => change('contactName', value)}
          maxLength={100}
          autoCapitalize="words"
          error={shown('contactName')}
          testID="addr-contact"
        />
        <PhoneField
          label={t('addr.phone')}
          value={form.phone}
          countryCode={form.countryCode}
          onChangeText={value => change('phone', value)}
          error={shown('phone')}
          testID="addr-phone"
        />
        <Field
          label={t('addr.line1')}
          value={form.line1}
          onChangeText={value => change('line1', value)}
          maxLength={500}
          error={shown('line1')}
          testID="addr-line1"
        />
        <Field
          label={t('addr.line2')}
          hint={t('form.optional')}
          value={form.line2}
          onChangeText={value => change('line2', value)}
          maxLength={500}
        />
        <SelectField
          label={t('addr.country')}
          value={form.countryCode}
          options={countryOptions}
          searchable
          loading={countries.isPending}
          onChange={value => {
            change('countryCode', value);
            setForm(current => ({
              ...current,
              state: '',
              stateCode: '',
              city: '',
            }));
          }}
        />
        <SelectField
          label={t('addr.state')}
          value={stateCode}
          options={stateOptions}
          searchable
          loading={states.isPending}
          onChange={value => {
            const name =
              states.data?.find(item => item.code === value)?.name ?? '';
            change('state', name);
            setForm(current => ({
              ...current,
              state: name,
              stateCode: value,
              city: '',
            }));
          }}
          error={shown('state')}
          testID="addr-state"
        />
        {cityOptions.length > 0 ? (
          <SelectField
            label={t('addr.city')}
            value={form.city}
            options={cityOptions}
            searchable
            onChange={value => change('city', value)}
            error={shown('city')}
            testID="addr-city"
          />
        ) : (
          <Field
            label={t('addr.city')}
            value={form.city}
            onChangeText={value => change('city', value)}
            maxLength={100}
            error={shown('city')}
            testID="addr-city"
          />
        )}
        <Field
          label={t('addr.zip')}
          value={form.zip}
          onChangeText={value => change('zip', value)}
          autoCapitalize="characters"
          maxLength={12}
          error={shown('zip')}
          testID="addr-zip"
        />
        <SwitchRow
          label={t('addr.defaultFor', {
            purpose: ADDRESS_PURPOSE_LABELS[form.purpose],
          })}
          value={form.isDefault}
          onValueChange={value => change('isDefault', value)}
          testID="addr-default"
        />
      </FormSection>

      <FormSection
        title={t('addr.section.pin')}
        description={t('addr.section.pinHint')}
      >
        <View style={styles.pinState} testID="addr-pin-state">
          <Icon
            name={hasPin(pin) ? 'place' : 'wrong_location'}
            size={20}
            color={hasPin(pin) ? colors.success : colors.warning}
          />
          <Text variant="small" style={styles.flex}>
            {t(locationNote)}
            {pin.source === 'GPS' && accuracy !== null
              ? ` ${t('loc.captured', { meters: accuracy })}`
              : ''}
          </Text>
          {hasPin(pin) ? (
            <Button
              label={t('loc.remove')}
              size="sm"
              variant="ghost"
              onPress={() => {
                setPin(NO_PIN);
                setDirty(true);
              }}
              testID="addr-pin-remove"
            />
          ) : null}
        </View>
        <Button
          label={locating ? t('loc.finding') : t('loc.use')}
          icon="my_location"
          variant="outline"
          onPress={() => {
            void captureHere();
          }}
          loading={locating}
          testID="addr-use-location"
        />
        {showMap ? (
          <Button
            label={hasPin(pin) ? t('pin.adjust') : t('pin.open')}
            icon="map"
            variant="outline"
            onPress={openMap}
            testID="addr-set-pin"
          />
        ) : null}
        <Button
          label={t('addr.find')}
          icon="search"
          variant="outline"
          onPress={() => {
            void findFromAddress();
          }}
          loading={finding}
          disabled={finding}
          testID="addr-find"
        />
        {pinNotice ? (
          <Banner
            tone={pinNotice.tone}
            message={pinNotice.text}
            actionLabel={pinNotice.settings ? t('loc.openSettings') : undefined}
            onAction={pinNotice.settings ? openLocationSettings : undefined}
            testID="addr-pin-notice"
          />
        ) : null}
        {missingPinWarning(form.purpose, pin) ? (
          <Text variant="small" color={colors.textMuted}>
            {t('addr.pinNeeded')}
          </Text>
        ) : null}
      </FormSection>
    </>
  );

  return (
    <FormScreen
      dirty={dirty}
      saving={saving}
      onSave={() => {
        void save();
      }}
      testID="screen-address-form"
    >
      {addressId && !existing ? (
        <LoadGate query={query}>
          {() =>
            loaded ? null : <Text variant="meta">{t('addr.notFound')}</Text>
          }
        </LoadGate>
      ) : (
        body
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pinState: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
