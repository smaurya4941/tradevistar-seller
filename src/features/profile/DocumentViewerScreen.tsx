/**
 * Viewing a private document. Fetches a fresh one-hour signed URL, downloads the file to the app's
 * private cache, opens it in the system viewer, and deletes the copy when the seller leaves this
 * screen or returns from the viewer. The file is never saved to the gallery or the Downloads
 * folder, and the signed URL is never shown or logged.
 */
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import type { SharedScreens } from '@/app/navigation/types';
import {
  discardViewedFile,
  downloadPrivateDocument,
  openViewedFile,
  ViewError,
  type ViewedFile,
} from '@/core/files/privateViewer';
import { Button, colors, Icon, spacing, Text } from '@/design';
import { useT } from '@/i18n';
import { SecureScreen } from './components/SecureScreen';

type Phase = 'downloading' | 'ready' | 'failed';

export function DocumentViewerScreen() {
  const t = useT();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<SharedScreens, 'DocumentViewer'>>();
  const [phase, setPhase] = useState<Phase>('downloading');
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<ViewError['kind']>('failed');
  const file = useRef<ViewedFile | null>(null);
  const opened = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setPhase('downloading');
    setProgress(null);
    try {
      await discardViewedFile(file.current);
      const downloaded = await downloadPrivateDocument(
        params.mediaAssetId,
        params.fileName,
        params.mimeType,
        setProgress,
      );
      if (!mounted.current) {
        await discardViewedFile(downloaded);
        return;
      }
      file.current = downloaded;
      setPhase('ready');
      opened.current = true;
      await openViewedFile(downloaded);
    } catch (error) {
      if (!mounted.current) return;
      setFailure(error instanceof ViewError ? error.kind : 'failed');
      setPhase('failed');
    }
  }, [params.fileName, params.mediaAssetId, params.mimeType]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      void discardViewedFile(file.current);
    };
  }, [load]);

  // Coming back from the viewer app: the copy has done its job.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && opened.current) {
        opened.current = false;
        void discardViewedFile(file.current);
        file.current = null;
        if (mounted.current) setPhase('ready');
      }
    });
    return () => subscription.remove();
  }, []);

  const again = async () => {
    // The copy may already be deleted; fetch a fresh one rather than reusing a stale path.
    await load();
  };

  return (
    <View style={styles.root} testID="screen-document-viewer">
      <SecureScreen />
      <Icon
        name={phase === 'failed' ? 'error' : 'description'}
        size={48}
        color={phase === 'failed' ? colors.error : colors.secondary}
      />
      <Text variant="h3" align="center" numberOfLines={2}>
        {params.fileName}
      </Text>
      {phase === 'downloading' ? (
        <>
          <ActivityIndicator color={colors.secondary} />
          <Text
            variant="meta"
            color={colors.textMuted}
            accessibilityLiveRegion="polite"
          >
            {progress === null
              ? t('doc.viewer.downloading')
              : t('doc.viewer.downloadingPercent', {
                  percent: Math.round(progress * 100),
                })}
          </Text>
        </>
      ) : null}
      {phase === 'ready' ? (
        <>
          <Text variant="body" color={colors.textMuted} align="center">
            {t('doc.viewer.opened')}
          </Text>
          <Button
            label={t('doc.viewer.again')}
            onPress={again}
            icon="open_in_new"
            testID="viewer-again"
          />
        </>
      ) : null}
      {phase === 'failed' ? (
        <>
          <Text variant="body" color={colors.textMuted} align="center">
            {t(
              failure === 'notFound'
                ? 'doc.viewer.notFound'
                : failure === 'network'
                ? 'doc.viewer.network'
                : 'doc.viewer.failed',
            )}
          </Text>
          <Button
            label={t('common.tryAgain')}
            onPress={again}
            testID="viewer-retry"
          />
        </>
      ) : null}
      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => navigation.goBack()}
      />
      <Text variant="small" color={colors.textMuted} align="center">
        {t('doc.viewer.privacy')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
});
