/** A password Field with a show/hide toggle and the autofill hints the Android password manager reads. */
import React, { forwardRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';
import { colors, Field, Icon, type FieldProps } from '@/design';
import { useT } from '@/i18n';

export interface PasswordFieldProps
  extends Omit<FieldProps, 'secureTextEntry' | 'trailing'> {
  /** A new password (registration, reset) rather than the existing one. */
  isNew?: boolean;
}

export const PasswordField = forwardRef<
  React.ComponentRef<typeof TextInput>,
  PasswordFieldProps
>(function PasswordFieldImpl({ isNew = false, ...rest }, ref) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      textContentType={isNew ? 'newPassword' : 'password'}
      trailing={
        <Pressable
          onPress={() => setVisible(value => !value)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('password.hide') : t('password.show')}
        >
          <Icon
            name={visible ? 'visibility_off' : 'visibility'}
            size={20}
            color={colors.outline}
          />
        </Pressable>
      }
      {...rest}
    />
  );
});
