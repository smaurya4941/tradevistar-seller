import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, palette, radii, shadows, spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export type ToastKind = 'info' | 'success' | 'error';

/** One button on the toast ("View cart", "Open in browser"). Pressing it also dismisses the toast. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

interface ToastApi {
  show(message: string, kind?: ToastKind, action?: ToastAction): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICON: Record<ToastKind, { name: string; color: string }> = {
  info: { name: 'info', color: palette.blue100 },
  success: { name: 'check_circle', color: '#8ECE93' },
  error: { name: 'error', color: '#FFB4AB' },
};

const DURATION_MS = 3500;
/** A toast with a button stays up longer, so there is time to reach it. */
const ACTION_DURATION_MS = 6000;

/** Brief, non-blocking feedback above the bottom edge; one at a time, newest wins. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      nextId.current += 1;
      setToast({ id: nextId.current, message, kind, action });
      AccessibilityInfo.announceForAccessibility(message);
    },
    [],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDone,
}: {
  toast: ToastMessage;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(onDone);
  }, [onDone, progress]);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    const timer = setTimeout(
      hide,
      toast.action ? ACTION_DURATION_MS : DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [hide, progress, toast.action]);

  const icon = ICON[toast.kind];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + spacing.xl,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={hide} accessibilityRole="alert" style={styles.toast}>
        <Icon name={icon.name} size={20} color={icon.color} />
        <View style={styles.flex}>
          <Text variant="label" color={colors.onToast}>
            {toast.message}
          </Text>
        </View>
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              hide();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            style={styles.action}
          >
            <Text variant="button" color={palette.orange100}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.toast,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    ...shadows.md,
  },
  flex: { flex: 1 },
  action: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
});
