import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import {
  colors,
  MAX_FONT_SCALE,
  typography,
  type TypographyVariant,
} from '../tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Text on the shared type scale. Font scaling stays on up to 200%; layouts wrap rather than clip. */
export function Text({
  variant = 'body',
  color = colors.onSurface,
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        typography[variant],
        { color },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
