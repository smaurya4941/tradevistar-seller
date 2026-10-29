/**
 * The 6-box code input used for sign-in, sign-up and password reset (and later for contact
 * changes and the GST ownership check).
 *
 * - One real TextInput sits invisibly over the boxes, so typing, pasting from the long-press
 *   menu, keyboard suggestions and SMS autofill all land in one place. Pasted text is reduced to
 *   its digits ("123 456" and "Your code is 123456" both work).
 * - The sixth digit submits automatically, but a code that was already submitted is never
 *   resubmitted on its own (the web's `submittedCode` guard); the buyer can still press Verify.
 * - Screen readers hear one field: "6-digit code, 3 of 6 entered".
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSmsConsent } from '@/core/native/smsConsent';
import { colors, fonts, HIT_TARGET, radii, spacing, Text } from '@/design';

export const OTP_LENGTH = 6;

export function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export interface OtpInputHandle {
  focus(): void;
  clear(): void;
}

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Called once per distinct complete code. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Listen for the code SMS (Android SMS User Consent). Off for email codes. */
  smsAutofill?: boolean;
  /** Changing this restarts SMS listening (after a resend). */
  listenKey?: number;
  accessibilityLabel: string;
  accessibilityProgress: string;
  testID?: string;
}

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(
  function OtpInputImpl(
    {
      value,
      onChange,
      onComplete,
      disabled = false,
      invalid = false,
      autoFocus = true,
      smsAutofill = false,
      listenKey = 0,
      accessibilityLabel,
      accessibilityProgress,
      testID,
    },
    ref,
  ) {
    const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
    const submitted = useRef('');
    const [focused, setFocused] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        submitted.current = '';
        onChange('');
      },
    }));

    const accept = useCallback(
      (raw: string) => {
        const next = sanitizeOtp(raw);
        onChange(next);
        if (next.length === OTP_LENGTH && next !== submitted.current) {
          submitted.current = next;
          onComplete(next);
        }
      },
      [onChange, onComplete],
    );

    useSmsConsent(smsAutofill && !disabled, listenKey, accept);

    const digits = value.split('');
    const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

    return (
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessible={false}
        style={styles.wrap}
      >
        <View
          style={styles.row}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {Array.from({ length: OTP_LENGTH }, (_, index) => {
            const filled = digits[index] !== undefined;
            const active = focused && !disabled && index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  filled && styles.boxFilled,
                  active && styles.boxActive,
                  invalid && styles.boxInvalid,
                  disabled && styles.boxDisabled,
                ]}
              >
                <Text style={styles.digit} allowFontScaling={false}>
                  {digits[index] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={accept}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          importantForAutofill="yes"
          // Longer than six so a pasted "123 456" or a sentence reaches the sanitiser intact.
          maxLength={64}
          caretHidden
          contextMenuHidden={false}
          selectionColor="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityProgress}
          accessibilityState={{ disabled }}
          style={styles.hiddenInput}
        />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    maxWidth: 54,
    minHeight: HIT_TARGET + 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.outline },
  boxActive: { borderColor: colors.secondary, borderWidth: 2 },
  boxInvalid: { borderColor: colors.error, borderWidth: 1.5 },
  boxDisabled: { backgroundColor: colors.surfaceContainer },
  digit: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.onSurface,
  },
  // Covers the boxes so long-press → Paste works anywhere on them, but draws nothing.
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    opacity: 0.02,
    fontSize: 1,
  },
});
