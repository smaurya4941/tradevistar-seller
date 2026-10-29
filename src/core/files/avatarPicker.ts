/**
 * Choosing a profile picture: the camera or the gallery, a square crop and compression, all done
 * natively by react-native-image-crop-picker. The result is a JPEG in the app's private cache,
 * checked against the server's 5 MB limit *after* compression so a large phone photo still works.
 * The photo is never saved to the gallery.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Image as ImageCompressor } from 'react-native-compressor';
import ImagePicker from 'react-native-image-crop-picker';
import { logger } from '@/core/logger';
import { CaptureError, stripScheme, type PickedFile } from './types';

export type AvatarSource = 'camera' | 'gallery';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const SIDE_PX = 800;

async function fileSize(uri: string): Promise<number> {
  try {
    return Number((await ReactNativeBlobUtil.fs.stat(stripScheme(uri))).size);
  } catch {
    return 0;
  }
}

/** Resolves with the cropped square, or null when the seller cancels. */
export async function pickAvatar(
  source: AvatarSource,
  cropTitle: string,
): Promise<PickedFile | null> {
  const options = {
    mediaType: 'photo' as const,
    cropping: true,
    width: SIDE_PX,
    height: SIDE_PX,
    cropperCircleOverlay: true,
    cropperToolbarTitle: cropTitle,
    compressImageMaxWidth: SIDE_PX,
    compressImageMaxHeight: SIDE_PX,
    compressImageQuality: 0.8,
    forceJpg: true,
    includeBase64: false,
    useFrontCamera: source === 'camera',
  };
  try {
    const image =
      source === 'camera'
        ? await ImagePicker.openCamera(options)
        : await ImagePicker.openPicker(options);
    const uri = image.path.startsWith('file://')
      ? image.path
      : `file://${image.path}`;
    let size = image.size || (await fileSize(uri));
    let finalUri = uri;
    if (size > AVATAR_MAX_BYTES) {
      finalUri = await ImageCompressor.compress(uri, {
        compressionMethod: 'manual',
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.6,
        output: 'jpg',
      });
      size = await fileSize(finalUri);
      if (size > AVATAR_MAX_BYTES) throw new CaptureError('size');
    }
    return {
      uri: finalUri,
      name: `avatar-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: size,
    };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'E_PICKER_CANCELLED') return null;
    if (error instanceof CaptureError) throw error;
    if (
      code === 'E_NO_CAMERA_PERMISSION' ||
      code === 'E_NO_LIBRARY_PERMISSION'
    ) {
      throw new CaptureError('permission');
    }
    logger.info('[avatar] picking failed');
    throw new CaptureError('unreadable');
  }
}

/** Removes the temporary copies the picker left in the cache. */
export async function cleanAvatarCache(): Promise<void> {
  try {
    await ImagePicker.clean();
  } catch {
    // Nothing to clean.
  }
}
