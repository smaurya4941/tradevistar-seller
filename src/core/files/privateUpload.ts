/**
 * Multipart uploads of private files (company documents, the GST certificate, the avatar) with
 * real progress, cancel, and one session refresh on a 401. react-native-blob-util streams the file
 * from disk, so a 5 MB PDF is never loaded into JavaScript memory.
 *
 * Failures are thrown as `ApiError`s built from the server's envelope, so the same error mapping
 * (`documentErrorKind`, `mapError`) works for uploads as for every other call. The file's name,
 * contents and the response never reach a log.
 */
import {
  ApiError,
  authorizedRequest,
  kycEvidenceUploadPath,
  newIdempotencyKey,
  refreshAccessToken,
  sellerDocumentUploadPath,
  type DocumentType,
  type UploadedMedia,
} from '@tradevistar/seller-api';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { logger } from '@/core/logger';
import { stripScheme, type PickedFile } from './types';

export interface UploadHandle<T> {
  promise: Promise<T>;
  cancel: () => void;
}

const SAFE_FILE = /[^A-Za-z0-9._-]+/g;
const uploadFileName = (name: string, mimeType: string) => {
  const base = name.replace(SAFE_FILE, '-').replace(/^-+|-+$/g, '') || 'file';
  if (mimeType === 'application/pdf' && !/\.pdf$/i.test(base))
    return `${base}.pdf`;
  return base;
};

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
}

export function uploadMultipart<T>(options: {
  path: string;
  file: PickedFile;
  accept: (data: unknown) => boolean;
  onProgress?: (fraction: number) => void;
}): UploadHandle<T> {
  const { path, file, accept, onProgress } = options;
  let current: ReturnType<typeof ReactNativeBlobUtil.fetch> | null = null;
  let cancelled = false;
  // One key for every attempt of this upload, so a retried request is not counted twice.
  const idempotencyKey = newIdempotencyKey();

  const attempt = async (): Promise<{ status: number; body: unknown }> => {
    const request = await authorizedRequest(path);
    current = ReactNativeBlobUtil.fetch(
      'POST',
      request.url,
      {
        ...request.headers,
        'Content-Type': 'multipart/form-data',
        'Idempotency-Key': idempotencyKey,
      },
      [
        {
          name: 'file',
          filename: uploadFileName(file.name, file.mimeType),
          type: file.mimeType,
          data: ReactNativeBlobUtil.wrap(stripScheme(file.uri)),
        },
      ],
    );
    current.uploadProgress({ interval: 150 }, (written, total) => {
      if (Number(total) > 0) onProgress?.(Number(written) / Number(total));
    });
    const response = await current;
    let body: unknown = null;
    try {
      body = response.json();
    } catch {
      body = null;
    }
    return { status: response.info().status, body };
  };

  const promise = (async (): Promise<T> => {
    try {
      let result = await attempt();
      if (result.status === 401 && !cancelled && (await refreshAccessToken())) {
        result = await attempt();
      }
      const envelope = result.body as Envelope<T> | null;
      if (
        result.status >= 200 &&
        result.status < 300 &&
        accept(envelope?.data)
      ) {
        onProgress?.(1);
        return envelope?.data as T;
      }
      throw new ApiError(result.status, {
        code:
          envelope?.error?.code ??
          (result.status === 413 ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_FAILED'),
        message: envelope?.error?.message ?? `Upload failed (${result.status})`,
        details: envelope?.error?.details,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (cancelled)
        throw new ApiError(0, {
          code: 'UPLOAD_CANCELLED',
          message: 'cancelled',
        });
      logger.info('[upload] failed before a response');
      throw new ApiError(0, {
        code: 'NETWORK_ERROR',
        message: 'Upload failed',
      });
    }
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      try {
        (
          current as unknown as { cancel?: (cb?: () => void) => void } | null
        )?.cancel?.(() => undefined);
      } catch {
        // Already finished.
      }
    },
  };
}

const isMedia = (data: unknown) =>
  typeof (data as UploadedMedia | undefined)?.id === 'string';

/** `POST /media/seller-documents/:type`: a company document (the route the web uses). */
export const uploadSellerDocument = (
  type: DocumentType,
  file: PickedFile,
  onProgress?: (fraction: number) => void,
) =>
  uploadMultipart<UploadedMedia>({
    path: sellerDocumentUploadPath(type),
    file,
    accept: isMedia,
    onProgress,
  });

/** `POST /media/kyc/:type`: the KYC-evidence route, which enforces PDF (the GST manual path). */
export const uploadKycEvidence = (
  type: DocumentType,
  file: PickedFile,
  onProgress?: (fraction: number) => void,
) =>
  uploadMultipart<UploadedMedia>({
    path: kycEvidenceUploadPath(type),
    file,
    accept: isMedia,
    onProgress,
  });

/** `POST /media/avatar`: a JPG, PNG or WebP picture under 5 MB. */
export const uploadAvatar = (
  file: PickedFile,
  onProgress?: (fraction: number) => void,
) =>
  uploadMultipart<unknown>({
    path: '/media/avatar',
    file,
    accept: () => true,
    onProgress,
  });
