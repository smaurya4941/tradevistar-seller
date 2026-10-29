/**
 * Viewing a private document. The app asks for a fresh one-hour signed URL, downloads the file to
 * its own cache, hands it to the system viewer, and deletes it afterwards. The file is never saved
 * to the gallery or the Downloads folder, and the signed URL is never logged or shown.
 *
 * The viewer app is another process, so the cached copy is deleted when the seller comes back to
 * the app (and any leftover is swept on launch and sign-out), not the instant the viewer opens.
 */
import { getMediaSignedUrl } from '@tradevistar/seller-api';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { logger } from '@/core/logger';

const { fs } = ReactNativeBlobUtil;

const cacheDirectory = () => `${fs.dirs.CacheDir}/private-documents`;

export class ViewError extends Error {
  constructor(readonly kind: 'network' | 'notFound' | 'failed') {
    super(kind);
    this.name = 'ViewError';
  }
}

export interface ViewedFile {
  path: string;
  fileName: string;
  mimeType: string;
}

export function safeFileName(name: string): string {
  const cleaned = Array.from(name)
    .map(char =>
      char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? '-' : char,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'document';
}

/** Downloads the document to the private cache. Rejects with a `ViewError`. */
export async function downloadPrivateDocument(
  mediaAssetId: string,
  fileName: string,
  mimeType: string,
  onProgress?: (fraction: number | null) => void,
): Promise<ViewedFile> {
  let url: string;
  try {
    url = (await getMediaSignedUrl(mediaAssetId)).url;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    throw new ViewError(status === 404 ? 'notFound' : 'network');
  }
  const directory = `${cacheDirectory()}/${Date.now().toString(
    36,
  )}${Math.random().toString(36).slice(2, 6)}`;
  const name = safeFileName(fileName);
  const path = `${directory}/${name}`;
  try {
    await fs.mkdir(directory).catch(() => undefined);
    const task = ReactNativeBlobUtil.config({ path }).fetch('GET', url);
    if (onProgress) {
      task.progress({ interval: 150 }, (received, total) => {
        onProgress(Number(total) > 0 ? Number(received) / Number(total) : null);
      });
    }
    const response = await task;
    const status = response.info().status;
    if (status < 200 || status >= 300) {
      await fs.unlink(directory).catch(() => undefined);
      throw new ViewError(status === 404 ? 'notFound' : 'failed');
    }
    return {
      path: response.path(),
      fileName: name,
      mimeType: mimeType || 'application/pdf',
    };
  } catch (error) {
    if (error instanceof ViewError) throw error;
    logger.info('[documents] the download failed');
    throw new ViewError('network');
  }
}

/** Opens the cached copy in the system viewer. */
export async function openViewedFile(file: ViewedFile): Promise<void> {
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.android.actionViewIntent(
      file.path,
      file.mimeType,
    );
    return;
  }
  await Share.open({
    url: `file://${file.path}`,
    type: file.mimeType,
    failOnCancel: false,
  });
}

/** Deletes a viewed copy (its whole folder). Safe on a file that is already gone. */
export async function discardViewedFile(
  file: Pick<ViewedFile, 'path'> | null | undefined,
): Promise<void> {
  if (!file) return;
  try {
    const directory = file.path.slice(0, file.path.lastIndexOf('/'));
    await fs.unlink(
      directory.startsWith(cacheDirectory()) ? directory : file.path,
    );
  } catch {
    // Already gone.
  }
}

/** Removes every leftover viewed document (launch, sign-out, leaving the viewer). */
export async function clearViewedDocuments(): Promise<void> {
  try {
    await fs.unlink(cacheDirectory());
  } catch {
    // Nothing cached.
  }
}
