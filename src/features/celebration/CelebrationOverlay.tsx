/**
 * The celebration itself: confetti, fireworks, balloons or stars falling over the app with a card
 * in the middle (the headline for its kind, the announcement's title and message). The pieces
 * ignore touches, so the app stays usable underneath; the card, its close button or the system
 * Back gesture end it early. It fades out in its last seconds and ends on time.
 *
 * Sellers who asked their phone for less motion get the card without the moving pieces.
 */
import type { CelebrationKind } from '@tradevistar/seller-api';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts, Icon, palette, radii, spacing, Text } from '@/design';
import { useReduceMotion } from '@/core/useReduceMotion';
import { useT, type TranslationKey } from '@/i18n';
import { buildPieces, CELEBRATION_EMOJI, type Piece } from './particles';

/** The last stretch in which the pieces fade away. */
export const FADE_OUT_MS = 2_500;

const HEADLINE: Record<CelebrationKind, TranslationKey> = {
  LAUNCH: 'cel.LAUNCH',
  NEW_FEATURE: 'cel.NEW_FEATURE',
  EVENT: 'cel.EVENT',
  FESTIVAL: 'cel.FESTIVAL',
  SALE: 'cel.SALE',
};

const PieceView = memo(function PieceItem({ piece }: { piece: Piece }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const run = Animated.sequence([
      Animated.delay(piece.delayMs),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: piece.durationMs,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(piece.pauseMs),
        ]),
      ),
    ]);
    run.start();
    return () => run.stop();
  }, [piece, progress]);

  const half = piece.size / 2;
  const style = {
    opacity: progress.interpolate({
      inputRange: [0, 0.04, 0.82, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: piece.x.map(value => value - half),
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: piece.y.map(value => value - half),
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            `${piece.tilt}deg`,
            `${piece.tilt + piece.turns * 360}deg`,
          ],
        }),
      },
      {
        scale: piece.twinkle
          ? progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 1, 0.1],
            })
          : 1,
      },
    ],
  };

  return (
    <Animated.View style={[styles.piece, style]} pointerEvents="none">
      {piece.shape === 'confetti' ? (
        <View
          style={{
            width: piece.size,
            height: piece.size * 0.55,
            backgroundColor: piece.color,
          }}
        />
      ) : piece.shape === 'spark' ? (
        <View
          style={{
            width: piece.size,
            height: piece.size,
            borderRadius: piece.size / 2,
            backgroundColor: piece.color,
          }}
        />
      ) : piece.shape === 'balloon' ? (
        <View
          style={{
            width: piece.size * 1.6,
            height: piece.size * 2,
            borderRadius: piece.size,
            backgroundColor: piece.color,
          }}
        />
      ) : piece.shape === 'star' ? (
        <Icon name="star" size={piece.size} color={piece.color} />
      ) : (
        <RNText style={{ fontSize: piece.size }}>{piece.glyph}</RNText>
      )}
    </Animated.View>
  );
});

export function CelebrationOverlay({
  kind,
  title,
  message,
  until,
  onDone,
}: {
  kind: CelebrationKind;
  title: string;
  message: string;
  /** Device clock, ms since epoch, when it ends. */
  until: number;
  onDone: () => void;
}) {
  const t = useT();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const layer = useRef(new Animated.Value(1)).current;
  const card = useRef(new Animated.Value(0)).current;
  const finish = useRef(onDone);
  finish.current = onDone;

  const pieces = useMemo(
    () => (reduceMotion ? [] : buildPieces(kind, { width, height })),
    [kind, reduceMotion, width, height],
  );

  useEffect(() => {
    Animated.timing(card, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    const remaining = Math.max(0, until - Date.now());
    const fade = setTimeout(() => {
      Animated.timing(layer, {
        toValue: 0,
        duration: Math.min(FADE_OUT_MS, remaining),
        useNativeDriver: true,
      }).start();
    }, Math.max(0, remaining - FADE_OUT_MS));
    const end = setTimeout(() => finish.current(), remaining);
    return () => {
      clearTimeout(fade);
      clearTimeout(end);
    };
  }, [card, layer, until]);

  // The system Back gesture closes the celebration before anything underneath.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        finish.current();
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID="celebration"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: layer }]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        {pieces.map(piece => (
          <PieceView key={piece.id} piece={piece} />
        ))}
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: card,
              transform: [
                {
                  scale: card.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel={t('cel.close')}
            accessibilityLiveRegion="polite"
            style={styles.cardPress}
            testID="celebration-card"
          >
            <Pressable
              onPress={onDone}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('cel.close')}
              style={styles.close}
              testID="celebration-close"
            >
              <Icon name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
            <RNText style={styles.emoji}>{CELEBRATION_EMOJI[kind]}</RNText>
            <Text
              variant="h2"
              align="center"
              color={palette.orange}
              accessibilityRole="header"
            >
              {t(HEADLINE[kind])}
            </Text>
            <Text variant="bodyStrong" align="center" color={palette.navy}>
              {title}
            </Text>
            {message ? (
              <Text
                variant="body"
                align="center"
                color={colors.onSurfaceVariant}
              >
                {message}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: palette.navy,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  cardPress: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 52, lineHeight: 64, fontFamily: fonts.regular },
});
