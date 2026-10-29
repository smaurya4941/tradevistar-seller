/** The new-password rules shared by registration and password reset: 8 to 128 characters, matching. */
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@tradevistar/seller-api';
import type { Translate } from '@/i18n';

export interface PasswordErrors {
  password?: string;
  confirm?: string;
}

/** The reasons a new password (and its confirmation) are not acceptable; empty when they are. */
export function newPasswordError(
  password: string,
  confirm: string,
  t: Translate,
): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!password) errors.password = t('password.required');
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = t('password.min', { count: MIN_PASSWORD_LENGTH });
  else if (password.length > MAX_PASSWORD_LENGTH)
    errors.password = t('password.max', { count: MAX_PASSWORD_LENGTH });
  if (!errors.password && password !== confirm)
    errors.confirm = t('password.mismatch');
  return errors;
}
