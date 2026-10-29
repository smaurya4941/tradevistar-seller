/**
 * The address pin map. It opens on the address's saved pin, else on what the typed address
 * geocodes to (an exact match also places the pin; an area match only centres the map, so an area
 * centre is never saved as a building's location), else on India. The seller drags the pin or taps
 * the map onto the building and confirms; only a confirmed pin goes back to the form.
 */
import { useNavigation } from '@react-navigation/native';
import {
  canGeocode,
  geocodeAddress,
  LocationError,
  pinMapStart,
  roundPin,
  type MapPoint,
  type PinMapStart,
} from '@tradevistar/seller-api';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';
import { logger } from '@/core/logger';
import { getCurrentLocation } from '@/core/native/currentLocation';
import { Button, colors, radii, spacing, Text } from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { getMapRequest, setMapResult } from './mapPinBridge';
import { FAILURE_MESSAGE, locationFailureOf } from './useLocationCapture';

const HINT: Record<PinMapStart['hint'], TranslationKey> = {
  saved: 'pin.hintSaved',
  exact: 'pin.hintExact',
  area: 'pin.hintArea',
  none: 'pin.hintNone',
};

const toCoordinate = (point: MapPoint) => ({
  latitude: point.lat,
  longitude: point.lng,
});

export function MapPinScreen() {
  const t = useT();
  const navigation = useNavigation();
  const map = useRef<MapView>(null);
  const [start, setStart] = useState<PinMapStart | null>(null);
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [hint, setHint] = useState<TranslationKey>('pin.loading');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  // The first render's request decides how the map opens; later edits must not rebuild it.
  const setup = useRef(getMapRequest());

  useEffect(() => {
    let cancelled = false;
    const request = setup.current;
    const saved = request?.pin ?? null;
    const typed = request?.address ?? {};
    (async () => {
      const found =
        !saved && canGeocode(typed)
          ? await geocodeAddress(
              typed as Parameters<typeof geocodeAddress>[0],
            ).catch(() => {
              logger.info('[pin] geocode failed; opening on India');
              return null;
            })
          : null;
      if (cancelled) return;
      const opening = pinMapStart(saved, found);
      setStart(opening);
      setPin(opening.pin);
      setHint(HINT[opening.hint]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const place = useCallback((point: MapPoint) => {
    setPin(roundPin(point));
    setNotice(null);
  }, []);

  const onMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    place({ lat: latitude, lng: longitude });
  };
  const onDragEnd = (event: MarkerDragStartEndEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    place({ lat: latitude, lng: longitude });
  };

  const moveToMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    setNotice(null);
    try {
      const fix = await getCurrentLocation();
      const point = { lat: fix.latitude, lng: fix.longitude };
      place(point);
      map.current?.animateToRegion(
        { ...toCoordinate(point), latitudeDelta: 0.003, longitudeDelta: 0.003 },
        400,
      );
    } catch (error) {
      setNotice(
        error instanceof LocationError
          ? FAILURE_MESSAGE[locationFailureOf(error)]
          : 'loc.unavailable',
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.root} testID="screen-map-pin">
      <Text variant="small" color={colors.onSurfaceVariant}>
        {t(hint)}
      </Text>
      <View style={styles.frame}>
        {start ? (
          <MapView
            ref={map}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              ...toCoordinate(start.center),
              latitudeDelta: start.delta,
              longitudeDelta: start.delta,
            }}
            onPress={onMapPress}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            accessibilityLabel={t('pin.mapA11y')}
            testID="map-pin-map"
          >
            {pin ? (
              <Marker
                coordinate={toCoordinate(pin)}
                draggable
                onDragEnd={onDragEnd}
                testID="map-pin-marker"
              />
            ) : null}
          </MapView>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
      {notice ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {t(notice)}
        </Text>
      ) : null}
      <Text variant="small" color={colors.textMuted} testID="map-pin-coords">
        {pin
          ? t('pin.coords', {
              lat: pin.lat.toFixed(7),
              lng: pin.lng.toFixed(7),
            })
          : t('pin.none')}
      </Text>
      <Button
        label={locating ? t('loc.finding') : t('pin.myLocation')}
        icon="my_location"
        variant="outline"
        onPress={() => {
          void moveToMyLocation();
        }}
        loading={locating}
        disabled={!start}
        testID="map-pin-mylocation"
      />
      <View style={styles.actions}>
        <Button
          label={t('pin.close')}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.action}
          testID="map-pin-close"
        />
        <Button
          label={t('pin.use')}
          onPress={() => {
            if (!pin) return;
            setMapResult(pin);
            navigation.goBack();
          }}
          disabled={!start || !pin}
          style={styles.action}
          testID="map-pin-confirm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  frame: {
    flex: 1,
    minHeight: 280,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
