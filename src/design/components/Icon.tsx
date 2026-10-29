import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { logger } from '@/core/logger';
import glyphs from '../icons/glyphMap';
import { colors, fonts } from '../tokens';

export interface IconProps {
  /** A Material Symbols glyph name — the same names the web portal uses (e.g. "shopping_bag"). */
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Spoken by screen readers; omit for decorative icons. */
  accessibilityLabel?: string;
}

/**
 * A Material Symbols Outlined glyph. Names map to code points, so a web status map or nav entry
 * works here unchanged; an unknown name renders nothing rather than a stray word.
 */
export function Icon({
  name,
  size = 24,
  color = colors.onSurface,
  style,
  accessibilityLabel,
}: IconProps) {
  const codepoint = glyphs[name];
  if (codepoint === undefined) {
    if (__DEV__) logger.warn(`Icon: unknown Material Symbols glyph "${name}"`);
    return null;
  }
  return (
    <Text
      allowFontScaling={false}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={
        accessibilityLabel ? 'yes' : 'no-hide-descendants'
      }
      style={[
        styles.glyph,
        { fontSize: size, lineHeight: size, width: size, height: size, color },
        style,
      ]}
    >
      {String.fromCodePoint(codepoint)}
    </Text>
  );
}

const styles = StyleSheet.create({
  glyph: { fontFamily: fonts.icons, textAlign: 'center' },
});
