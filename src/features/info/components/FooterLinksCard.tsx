/**
 * A titled list of footer pages (a footer column from Admin → Footer). Each row opens the page in
 * the app; the success-stories page opens its own list of stories. Renders nothing for an empty
 * column, so a screen can show every column it wants.
 */
import { FOOTER_SLUGS, type FooterLink } from '@tradevistar/seller-api';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { openRoute } from '@/app/navigation/openHref';
import { Card, Divider, ListRow, SectionTitle } from '@/design';
import { openFooterPage } from '../openLinks';

export function openFooterLinkRow(link: FooterLink): void {
  if (link.slug === FOOTER_SLUGS.successStories) {
    openRoute({ name: 'Shared', params: { screen: 'SuccessStories' } });
    return;
  }
  openFooterPage(link.slug);
}

export function FooterLinksCard({
  title,
  links,
  icon = 'article',
  testID,
}: {
  title: string;
  links: readonly FooterLink[];
  icon?: string;
  testID?: string;
}) {
  if (!links.length) return null;
  return (
    <View style={styles.group} testID={testID}>
      <SectionTitle>{title}</SectionTitle>
      <Card style={styles.list}>
        {links.map((link, index) => (
          <React.Fragment key={link.slug}>
            {index > 0 ? <Divider style={styles.inset} /> : null}
            <ListRow
              testID={`info-link-${link.slug}`}
              icon={icon}
              label={link.label}
              onPress={() => openFooterLinkRow(link)}
            />
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  inset: { marginLeft: 64 },
});
