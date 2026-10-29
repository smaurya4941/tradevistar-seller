/** Registration is in. No session exists until an admin approves; this screen says what happens next. */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { Banner, Button, colors, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterSubmitted'
>;

export function RegisterSubmittedScreen() {
  const t = useT();
  const navigation = useNavigation<Navigation>();
  const { linked } =
    useRoute<RouteProp<RootStackParamList, 'RegisterSubmitted'>>().params;

  return (
    <AuthScreenLayout
      testID="screen-register-submitted"
      title={t('register.submitted.title')}
      icon="verified"
      showBack={false}
    >
      <Text variant="body" color={colors.textMuted}>
        {t('register.submitted.body')}
      </Text>
      {linked ? (
        <Banner
          tone="green"
          message={t('register.submitted.linked')}
          testID="register-submitted-linked"
        />
      ) : null}
      <View style={{ marginTop: spacing.sm }}>
        <Button
          label={t('register.submitted.action')}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })
          }
          fullWidth
          testID="register-submitted-done"
        />
      </View>
    </AuthScreenLayout>
  );
}
