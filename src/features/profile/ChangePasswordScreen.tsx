/**
 * Change password: the current password, a new one (8–128 characters with a lowercase letter, an
 * uppercase letter and a digit — stricter than sign-up, which the hint explains) and a confirm
 * field, with a strength meter. On success the server signs the other devices out and this phone's
 * session is renewed straight away.
 */
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  changePassword,
  isAcceptableNewPassword,
  PASSWORD_SCORE_LABEL,
  passwordProblems,
  passwordScore,
} from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import { track } from '@/core/analytics/analytics';
import { logger } from '@/core/logger';
import { useUnsavedGuard } from '@/core/forms/useUnsavedGuard';
import {
  Banner,
  colors,
  FormScreen,
  FormSection,
  radii,
  spacing,
  Text,
  useToast,
} from '@/design';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { useT } from '@/i18n';
import { changePasswordAndRenew } from './accountChanges';
import { SecureScreen } from './components/SecureScreen';
import { companyKeys } from './data';
import { profileErrorMessage } from './errors';

const SCORE_COLOR = [
  colors.outlineVariant,
  colors.error,
  colors.warning,
  colors.success,
  colors.success,
] as const;

export function ChangePasswordScreen() {
  const t = useT();
  const navigation = useNavigation();
  const toast = useToast();
  const client = useQueryClient();
  const engine = useSessionEngine();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = current !== '' || next !== '' || confirm !== '';
  const { allowLeave } = useUnsavedGuard(touched && !saving);

  const problems = passwordProblems(next);
  const score = passwordScore(next);
  const errors = {
    current: current ? undefined : t('pw.currentRequired'),
    next: isAcceptableNewPassword(next) ? undefined : t('pw.rule'),
    confirm: confirm === next && confirm !== '' ? undefined : t('pw.mismatch'),
  };

  const save = async () => {
    setShowErrors(true);
    setError(null);
    if (errors.current || errors.next || errors.confirm) return;
    setSaving(true);
    try {
      const revoked = await changePasswordAndRenew({
        change: () =>
          changePassword({ currentPassword: current, newPassword: next }),
        renewSession: () => engine.renewSession(),
        onRenewFailed: () =>
          logger.info(
            '[password] renewing the session failed; the retry will cover it',
          ),
      });
      track('password_changed', {});
      void client.invalidateQueries({ queryKey: companyKeys.security });
      void client.invalidateQueries({ queryKey: companyKeys.sessions });
      toast.show(
        revoked > 0 ? t('pw.doneOthers', { count: revoked }) : t('pw.done'),
        'success',
      );
      allowLeave();
      navigation.goBack();
    } catch (caught) {
      setError(profileErrorMessage(caught, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      dirty={touched}
      saving={saving}
      onSave={() => {
        void save();
      }}
      saveLabel={t('pw.save')}
      testID="screen-change-password"
    >
      <SecureScreen />
      {error ? <Banner tone="red" message={error} testID="pw-error" /> : null}
      <FormSection title={t('pw.title')}>
        <PasswordField
          label={t('pw.current')}
          value={current}
          onChangeText={setCurrent}
          error={showErrors ? errors.current : undefined}
          testID="pw-current"
        />
        <PasswordField
          label={t('pw.new')}
          isNew
          value={next}
          onChangeText={setNext}
          maxLength={128}
          hint={t('pw.hint')}
          error={showErrors ? errors.next : undefined}
          testID="pw-new"
        />
        <View
          style={styles.meter}
          accessible
          accessibilityLabel={t('pw.strength', {
            level: PASSWORD_SCORE_LABEL[score] || t('pw.none'),
          })}
        >
          <View style={styles.bars}>
            {[1, 2, 3, 4].map(level => (
              <View
                key={level}
                style={[
                  styles.bar,
                  {
                    backgroundColor:
                      score >= level
                        ? SCORE_COLOR[score]
                        : colors.outlineVariant,
                  },
                ]}
              />
            ))}
          </View>
          <Text variant="small" color={colors.textMuted}>
            {PASSWORD_SCORE_LABEL[score]}
          </Text>
        </View>
        {next.length > 0 && problems.length > 0 ? (
          <Text variant="small" color={colors.textMuted}>
            {problems
              .map(problem => t(`pw.problem.${problem}` as 'pw.problem.length'))
              .join(' · ')}
          </Text>
        ) : null}
        <PasswordField
          label={t('pw.confirm')}
          isNew
          value={confirm}
          onChangeText={setConfirm}
          maxLength={128}
          error={showErrors ? errors.confirm : undefined}
          testID="pw-confirm"
        />
      </FormSection>
      <Text variant="small" color={colors.textMuted}>
        {t('pw.signOutNote')}
      </Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  meter: { gap: spacing.xs },
  bars: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: 6, borderRadius: radii.pill },
});
