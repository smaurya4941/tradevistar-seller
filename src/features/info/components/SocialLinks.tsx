/**
 * The social profiles an admin set in Admin → Footer, as a row of labelled buttons that open in
 * the browser or the network's own app. Renders nothing when none are set.
 */
import {
  socialLinks,
  type FooterSettings,
  type SocialNetwork,
} from '@tradevistar/seller-api';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  radii,
  SectionTitle,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { openFooterLink } from '../openLinks';

const ICON: Record<SocialNetwork, string> = {
  facebook: 'thumb_up',
  instagram: 'photo_camera',
  linkedin: 'work',
  whatsapp: 'chat',
  x: 'tag',
  youtube: 'smart_display',
};

export function SocialLinks({
  settings,
}: {
  settings: FooterSettings | null | undefined;
}) {
  const t = useT();
  const toast = useToast();
  const links = socialLinks(settings);
  if (!links.length) return null;
  return (
    <View style={styles.group} testID="info-social">
      <SectionTitle>{t('infolinks.follow')}</SectionTitle>
      <View style={styles.row}>
        {links.map(({ network, url }) => {
          const label = t(`infolinks.social.${network}` as TranslationKey);
          return (
            <Pressable
              key={network}
              testID={`info-social-${network}`}
              onPress={() => {
                void openFooterLink({ kind: 'external', url }).then(opened => {
                  if (!opened) toast.show(t('info.linkFailed'), 'error');
                });
              }}
              accessibilityRole="link"
              accessibilityLabel={label}
              style={styles.chip}
            >
              <Icon name={ICON[network]} size={18} color={colors.secondary} />
              <Text variant="label" color={colors.secondary}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
});
