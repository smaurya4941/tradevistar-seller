/**
 * Asks "Leave without saving?" when the seller backs out of a screen with unsaved changes: the
 * Android back button, the header arrow and a swipe all go through React Navigation's
 * `beforeRemove`. Navigation that the screen itself triggers after a save passes `allowLeave()`.
 */
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useT } from '@/i18n';

export function useUnsavedGuard(dirty: boolean): { allowLeave: () => void } {
  const navigation = useNavigation();
  const t = useT();
  const allowed = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', event => {
      if (!dirty || allowed.current) return;
      event.preventDefault();
      Alert.alert(t('form.leaveTitle'), t('form.leaveBody'), [
        { text: t('form.stay'), style: 'cancel' },
        {
          text: t('form.leave'),
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
  }, [dirty, navigation, t]);

  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);

  return { allowLeave };
}
