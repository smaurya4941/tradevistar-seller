/**
 * Writes a CSV report to the app's cache and opens the system share sheet on it, so the seller can
 * send it to a mail app, a drive or a spreadsheet. The file is private to the app until shared.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

export class ExportCancelled extends Error {
  constructor() {
    super('The share sheet was dismissed');
    this.name = 'ExportCancelled';
  }
}

/** `seller-analytics-6-months` for a 6-month report: file-safe characters only. */
export function csvFileName(base: string): string {
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'report'}.csv`;
}

/**
 * Saves `csv` and shares it. Resolves when the sheet closes after sharing; rejects with
 * `ExportCancelled` when the seller dismisses it without choosing an app.
 */
export async function shareCsv(base: string, csv: string): Promise<void> {
  const fileName = csvFileName(base);
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  // A byte-order mark makes Excel read the file as UTF-8 (rupee signs, accented names).
  await ReactNativeBlobUtil.fs.writeFile(path, `﻿${csv}`, 'utf8');
  try {
    await Share.open({
      url: `file://${path}`,
      type: 'text/csv',
      filename: fileName,
      failOnCancel: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|dismiss/i.test(message)) throw new ExportCancelled();
    throw error;
  }
}
