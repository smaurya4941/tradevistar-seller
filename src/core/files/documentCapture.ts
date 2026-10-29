/**
 * Getting a document onto the phone as a PDF.
 *
 * The web accepts PDF only for company documents, and compliance reviewers expect it, so every
 * route here ends as a PDF even where the backend would take an image:
 * - Scan: the platform document scanner (ML Kit on Android), several pages, edge detection and
 *   crop built in;
 * - Gallery photos: picked, then ordered and trimmed on the preview screen;
 * - Files: a PDF picked from storage, passed through as it is.
 *
 * Scans and photos are resized (long edge 1,600 px, JPEG quality 0.7), combined into one PDF with
 * no native PDF library (`pdfBuilder`), aiming for under 5 MB and retrying at lower quality when
 * over. Everything lives in the app's private cache; nothing is written to the gallery or the
 * downloads folder, and every temporary is deleted after upload (`deleteLocalFile`).
 */
import {
  DOCUMENT_UPLOAD_LIMITS,
  nextQuality,
  sizeVerdict,
} from '@tradevistar/seller-api';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types as documentTypes,
} from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Image as ImageCompressor } from 'react-native-compressor';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { launchImageLibrary } from 'react-native-image-picker';
import { logger } from '@/core/logger';
import {
  base64ToBytes,
  buildPdf,
  bytesToBase64,
  readJpegInfo,
  type JpegPage,
} from './pdfBuilder';
import { CaptureError, stripScheme, type PickedFile } from './types';

const { fs } = ReactNativeBlobUtil;

export async function deleteLocalFile(
  uri: string | null | undefined,
): Promise<void> {
  if (!uri) return;
  try {
    await fs.unlink(stripScheme(uri));
  } catch {
    // Already gone.
  }
}

export const deleteLocalFiles = (
  uris: readonly (string | null | undefined)[],
) => Promise.all(uris.map(deleteLocalFile)).then(() => undefined);

async function sizeOf(uri: string): Promise<number> {
  try {
    return Number((await fs.stat(stripScheme(uri))).size);
  } catch {
    return 0;
  }
}

/**
 * Opens the scanner. Resolves with the scanned page images (cache URIs), or `[]` when the seller
 * closes it without finishing. Throws `CaptureError('unavailable')` when the scanner cannot run.
 */
export async function scanPages(maxPages: number): Promise<string[]> {
  try {
    const result = await DocumentScanner.scanDocument({
      croppedImageQuality: 90,
      maxNumDocuments: maxPages,
    });
    if (result.status !== ScanDocumentResponseStatus.Success) return [];
    return result.scannedImages ?? [];
  } catch (error) {
    logger.info('[documents] the scanner could not run', error);
    throw new CaptureError('unavailable');
  }
}

/** Photos from the gallery (up to `limit`), as cache URIs. */
export async function pickGalleryPages(limit: number): Promise<string[]> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: Math.max(1, limit),
    maxWidth: 3000,
    maxHeight: 3000,
    quality: 0.9,
  });
  if (result.didCancel) return [];
  if (result.errorCode) throw new CaptureError('unreadable');
  return (result.assets ?? [])
    .map(asset => asset.uri)
    .filter((uri): uri is string => Boolean(uri));
}

/** Lets the seller choose a PDF from storage; a copy goes to the private cache. Null on cancel. */
export async function pickPdfFile(): Promise<PickedFile | null> {
  try {
    const [picked] = await pick({ type: [documentTypes.pdf] });
    if (!picked) return null;
    const name = picked.name ?? `document-${Date.now()}.pdf`;
    const looksLikePdf =
      (picked.type ?? '').toLowerCase() === 'application/pdf' ||
      name.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) throw new CaptureError('type');
    const [copy] = await keepLocalCopy({
      files: [{ uri: picked.uri, fileName: name }],
      destination: 'cachesDirectory',
    });
    if (!copy || copy.status !== 'success')
      throw new CaptureError('unreadable');
    const sizeBytes = picked.size ?? (await sizeOf(copy.localUri));
    if (sizeBytes > DOCUMENT_UPLOAD_LIMITS.hardBytes) {
      await deleteLocalFile(copy.localUri);
      throw new CaptureError('size');
    }
    return {
      uri: copy.localUri,
      name,
      mimeType: 'application/pdf',
      sizeBytes,
    };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    if (
      isErrorWithCode(error) &&
      error.code === errorCodes.OPERATION_CANCELED
    ) {
      return null;
    }
    logger.info('[documents] picking a PDF failed', error);
    throw new CaptureError('unreadable');
  }
}

const safeName = (label: string) =>
  label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';

async function pagesToPdf(
  pages: readonly string[],
  quality: number,
  label: string,
): Promise<PickedFile> {
  const temporary: string[] = [];
  try {
    const jpegs: JpegPage[] = [];
    for (const uri of pages) {
      const compressed = await ImageCompressor.compress(uri, {
        compressionMethod: 'manual',
        maxWidth: DOCUMENT_UPLOAD_LIMITS.longSidePx,
        maxHeight: DOCUMENT_UPLOAD_LIMITS.longSidePx,
        quality,
        output: 'jpg',
      });
      temporary.push(compressed);
      const base64 = await fs.readFile(stripScheme(compressed), 'base64');
      const bytes = base64ToBytes(base64);
      const info = readJpegInfo(bytes);
      if (!info) throw new CaptureError('unreadable');
      jpegs.push({ bytes, ...info });
    }
    const pdf = buildPdf(jpegs);
    const name = `${safeName(label)}-${Date.now()}.pdf`;
    const target = `${fs.dirs.CacheDir}/${name}`;
    await fs.writeFile(target, bytesToBase64(pdf), 'base64');
    return {
      uri: `file://${target}`,
      name,
      mimeType: 'application/pdf',
      sizeBytes: pdf.length,
    };
  } finally {
    await deleteLocalFiles(temporary);
  }
}

/**
 * Combines pages (scans or photos, in the order given) into one PDF under the size target,
 * retrying at lower JPEG quality while it is over. A PDF over the 25 MB hard limit is refused.
 */
export async function buildPdfFromPages(
  pages: readonly string[],
  label: string,
): Promise<PickedFile> {
  if (pages.length === 0) throw new CaptureError('unreadable');
  if (pages.length > DOCUMENT_UPLOAD_LIMITS.maxPages)
    throw new CaptureError('size');
  let quality: number | null = DOCUMENT_UPLOAD_LIMITS.jpegQuality;
  let last: PickedFile | null = null;
  try {
    while (quality !== null) {
      if (last) await deleteLocalFile(last.uri);
      last = await pagesToPdf(pages, quality, label);
      const lower = nextQuality(quality);
      const verdict = sizeVerdict(last.sizeBytes, lower !== null);
      if (verdict === 'ok') return last;
      if (verdict === 'tooLarge') break;
      quality = lower;
    }
  } catch (error) {
    await deleteLocalFile(last?.uri);
    if (error instanceof CaptureError) throw error;
    logger.info('[documents] building the PDF failed', error);
    throw new CaptureError('unreadable');
  }
  await deleteLocalFile(last?.uri);
  throw new CaptureError('size');
}
