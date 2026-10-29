/** A file the app holds in its own private cache, ready to upload. */
export interface PickedFile {
  /** `file://` URI of a copy in the app's cache. */
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export type CaptureProblem =
  | 'unavailable'
  | 'unreadable'
  | 'permission'
  | 'type'
  | 'size';

export class CaptureError extends Error {
  constructor(readonly problem: CaptureProblem) {
    super(problem);
    this.name = 'CaptureError';
  }
}

export const stripScheme = (uri: string): string =>
  uri.replace(/^file:\/\//, '');
