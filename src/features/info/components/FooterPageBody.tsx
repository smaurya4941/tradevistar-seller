/**
 * A footer page's content as native text: headings, paragraphs, bulleted and numbered lists,
 * **bold**, and links that open where they point (see openLinks). Nothing is rendered as HTML.
 */
import {
  parseFooterBody,
  parseInline,
  type FooterBlock,
} from '@tradevistar/seller-api';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, spacing, Text, useToast } from '@/design';
import { useT } from '@/i18n';
import { openFooterLink } from '../openLinks';

function Inline({ text }: { text: string }) {
  const t = useT();
  const toast = useToast();
  const pieces = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {pieces.map((piece, index) => {
        if (piece.kind === 'bold') {
          return (
            <Text key={index} variant="bodyStrong" color={colors.secondary}>
              {piece.text}
            </Text>
          );
        }
        if (piece.kind === 'link') {
          return (
            <Text
              key={index}
              variant="bodyStrong"
              color={colors.link}
              style={styles.link}
              accessibilityRole="link"
              onPress={() => {
                void openFooterLink(piece.link).then(opened => {
                  if (!opened) toast.show(t('info.linkFailed'), 'error');
                });
              }}
            >
              {piece.text}
            </Text>
          );
        }
        return <React.Fragment key={index}>{piece.text}</React.Fragment>;
      })}
    </>
  );
}

function Block({ block }: { block: FooterBlock }) {
  switch (block.kind) {
    case 'h2':
      return (
        <Text variant="h2" color={colors.secondary} accessibilityRole="header">
          <Inline text={block.text} />
        </Text>
      );
    case 'h3':
      return (
        <Text variant="h3" color={colors.secondary} accessibilityRole="header">
          <Inline text={block.text} />
        </Text>
      );
    case 'ul':
    case 'ol':
      return (
        <View style={styles.list} accessibilityRole="list">
          {block.items.map((item, index) => (
            <View key={index} style={styles.item}>
              <Text
                variant="bodyStrong"
                color={colors.primary}
                style={styles.marker}
                importantForAccessibility="no"
              >
                {block.kind === 'ul' ? '•' : `${index + 1}.`}
              </Text>
              <Text
                variant="body"
                color={colors.onSurfaceVariant}
                style={styles.flex}
              >
                <Inline text={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    default:
      return (
        <Text variant="body" color={colors.onSurfaceVariant} selectable>
          <Inline text={block.text} />
        </Text>
      );
  }
}

export function FooterPageBody({ body }: { body: string }) {
  const blocks = useMemo(() => parseFooterBody(body), [body]);
  return (
    <View style={styles.body} testID="info-body">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  list: { gap: spacing.xs },
  item: { flexDirection: 'row', gap: spacing.sm },
  marker: { minWidth: 18, fontFamily: fonts.semibold },
  flex: { flex: 1 },
  link: { textDecorationLine: 'underline' },
});
