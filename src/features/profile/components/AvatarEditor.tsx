/**
 * Changing the profile picture: take a photo or pick one, crop it square, compress it, upload it
 * (JPG, PNG or WebP under 5 MB, checked after compression), then refresh the signed-in user so
 * the new picture shows everywhere. "Remove photo" asks first. The camera and gallery prompts are
 * explained before the system asks.
 */
import { getMe, removeAvatar } from '@tradevistar/seller-api';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cleanAvatarCache,
  pickAvatar,
  type AvatarSource,
} from '@/core/files/avatarPicker';
import { deleteLocalFile } from '@/core/files/documentCapture';
import { uploadAvatar } from '@/core/files/privateUpload';
import { CaptureError } from '@/core/files/types';
import { useSessionEngine } from '@/core/auth/SessionProvider';
import {
  BottomSheet,
  Button,
  colors,
  ConfirmDialog,
  spacing,
  Text,
  useToast,
} from '@/design';
import { useT } from '@/i18n';
import { profileErrorMessage } from '../errors';

export function AvatarEditor({
  visible,
  hasPhoto,
  onClose,
  onChanged,
}: {
  visible: boolean;
  hasPhoto: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const engine = useSessionEngine();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refreshUser = async () => {
    const user = await getMe();
    engine.adoptUser(user);
    onChanged();
  };

  const choose = async (source: AvatarSource) => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await pickAvatar(source, t('avatar.cropTitle'));
      if (!file) return;
      try {
        await uploadAvatar(file).promise;
      } finally {
        await deleteLocalFile(file.uri);
        await cleanAvatarCache();
      }
      await refreshUser();
      onClose();
      toast.show(t('avatar.updated'), 'success');
    } catch (error) {
      if (error instanceof CaptureError) {
        toast.show(
          t(
            error.problem === 'permission'
              ? 'avatar.permission'
              : error.problem === 'size'
              ? 'avatar.tooLarge'
              : 'avatar.failed',
          ),
          'error',
        );
      } else {
        toast.show(profileErrorMessage(error, t), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeAvatar();
      await refreshUser();
      setConfirmRemove(false);
      onClose();
      toast.show(t('avatar.removed'), 'success');
    } catch (error) {
      setConfirmRemove(false);
      toast.show(profileErrorMessage(error, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={t('avatar.title')}
      >
        <View style={styles.body}>
          <Text variant="meta" color={colors.textMuted}>
            {t('avatar.explain')}
          </Text>
          <Button
            label={t('avatar.camera')}
            icon="photo_camera"
            onPress={() => {
              void choose('camera');
            }}
            disabled={busy}
            loading={busy}
            testID="avatar-camera"
          />
          <Button
            label={t('avatar.gallery')}
            icon="photo_library"
            variant="outline"
            onPress={() => {
              void choose('gallery');
            }}
            disabled={busy}
            testID="avatar-gallery"
          />
          {hasPhoto ? (
            <Button
              label={t('avatar.remove')}
              icon="delete"
              variant="ghost"
              onPress={() => setConfirmRemove(true)}
              disabled={busy}
              testID="avatar-remove"
            />
          ) : null}
          <Text variant="small" color={colors.textMuted}>
            {t('avatar.limits')}
          </Text>
        </View>
      </BottomSheet>
      <ConfirmDialog
        visible={confirmRemove}
        title={t('avatar.remove.title')}
        message={t('avatar.remove.body')}
        confirmLabel={t('form.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, padding: spacing.lg },
});
