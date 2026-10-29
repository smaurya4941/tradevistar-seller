/**
 * GST ownership on its own page — the target of "verify your GST" links. It is the same card the
 * GST and tax screen shows, with the saved tax record; the card hides itself when no GSTIN is
 * saved or it is already verified.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import { Button, colors, EmptyState, spacing } from '@/design';
import { useT } from '@/i18n';
import { GstOwnershipCard } from './components/GstOwnershipCard';
import { LoadGate } from './components/LoadGate';
import { SecureScreen } from './components/SecureScreen';
import { useTax } from './data';

export function GstOwnershipScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<SharedScreens>>();
  const query = useTax();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="screen-gst-ownership"
    >
      <SecureScreen />
      <LoadGate query={query}>
        {tax =>
          tax.gstin && tax.verificationState !== 'VERIFIED' ? (
            <GstOwnershipCard tax={tax} hasUnsavedEdits={false} />
          ) : (
            <>
              <EmptyState
                icon={tax.gstin ? 'verified' : 'receipt_long'}
                title={
                  tax.gstin
                    ? t('gst.page.doneTitle')
                    : t('gst.page.noGstinTitle')
                }
                message={
                  tax.gstin ? t('gst.page.doneBody') : t('gst.page.noGstinBody')
                }
              />
              <Button
                label={t('gst.page.open')}
                variant="outline"
                onPress={() => navigation.replace('TaxGst')}
              />
            </>
          )
        }
      </LoadGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
});
