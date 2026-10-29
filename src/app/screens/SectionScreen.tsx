/**
 * A More-menu area whose real screens arrive in a later phase. Later phases replace this screen
 * per section in the navigators; the menu and the route names stay as they are.
 *
 * The route can carry the query a link or a search result brought (`?order=<id>`); the screen that
 * replaces this one reads it, so nothing the seller tapped is lost on the way.
 */
import { useRoute, type RouteProp } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '@/design';
import { useT } from '@/i18n';
import { SectionPlaceholder } from '../components/SectionPlaceholder';
import { sectionById } from '../navigation/sections';
import type { SharedScreens } from '../navigation/types';

export function SectionScreen() {
  const t = useT();
  const route = useRoute<RouteProp<SharedScreens, 'Section'>>();
  const section = sectionById(route.params.sectionId);
  if (!section) return null;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID={`screen-section-${section.id}`}
    >
      <SectionPlaceholder
        icon={section.icon}
        title={t(section.labelKey)}
        body={t('placeholder.section.body')}
        webPath={section.webPath}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
});
