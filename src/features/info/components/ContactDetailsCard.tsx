/**
 * A footer page's contact details: email (opens mail), phone (opens the dialler) and address
 * (opens maps). Each row reads as one phrase to a screen reader.
 */
import {
  contactRows,
  type ContactKind,
  type FooterPage,
} from '@tradevistar/seller-api';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card,
  colors,
  Icon,
  radii,
  spacing,
  Text,
  tones,
  useToast,
} from '@/design';
import { useT, type TranslationKey } from '@/i18n';
import { openExternal } from '../openLinks';

const ICON: Record<ContactKind, string> = {
  email: 'mail',
  phone: 'call',
  address: 'location_on',
};

const LABEL: Record<ContactKind, TranslationKey> = {
  email: 'info.email',
  phone: 'info.phone',
  address: 'info.address',
};

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;

export function ContactDetailsCard({
  page,
}: {
  page: Pick<FooterPage, 'contactEmail' | 'contactPhone' | 'contactAddress'>;
}) {
  const t = useT();
  const toast = useToast();
  const rows = contactRows(page);
  if (!rows.length) return null;

  return (
    <Card style={styles.card} testID="info-contact">
      <Text variant="cardTitle" accessibilityRole="header">
        {t('info.contactDetails')}
      </Text>
      {rows.map(row => {
        const url =
          row.url ?? (row.kind === 'address' ? mapsUrl(row.value) : null);
        const label = t(LABEL[row.kind]);
        return (
          <Pressable
            key={row.kind}
            testID={`info-contact-${row.kind}`}
            disabled={!url}
            onPress={() => {
              if (!url) return;
              void openExternal(url).then(opened => {
                if (!opened) toast.show(t('info.linkFailed'), 'error');
              });
            }}
            accessibilityRole={url ? 'link' : 'text'}
            accessibilityLabel={`${label}: ${row.value}`}
            accessibilityHint={
              row.kind === 'address' ? t('info.openMap') : undefined
            }
            style={styles.row}
          >
            <View style={styles.icon}>
              <Icon
                name={ICON[row.kind]}
                size={18}
                color={tones.blue.foreground}
              />
            </View>
            <View style={styles.flex}>
              <Text variant="small" color={colors.textMuted}>
                {label}
              </Text>
              <Text
                variant="bodyStrong"
                color={url ? colors.link : colors.secondary}
                selectable
              >
                {row.value}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 44,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: tones.blue.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
