/* eslint-disable no-bitwise -- byte-level encoding (base64, JPEG markers) needs shifts and masks */
/**
 * Combines scanned pages into one PDF on the phone (a two-sided ID, a multi-page certificate),
 * with no native PDF library: a JPEG can be placed in a PDF as it is (the DCTDecode filter), so
 * the file is just the pages' own bytes wrapped in a few objects. No re-encoding, no quality loss.
 *
 * Pure functions on bytes; the file reading and writing around them is in `documentCapture.ts`.
 */

export interface JpegPage {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** 1 (grey), 3 (RGB) or 4 (CMYK) colour components. */
  components: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i += 1) B64_LOOKUP[B64[i]] = i;

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean[i]];
    const b = B64_LOOKUP[clean[i + 1]];
    const c = i + 2 < clean.length ? B64_LOOKUP[clean[i + 2]] : undefined;
    const d = i + 3 < clean.length ? B64_LOOKUP[clean[i + 3]] : undefined;
    out[o++] = (a << 2) | (b >> 4);
    if (c !== undefined) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (c !== undefined && d !== undefined) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

/**
 * Reads a JPEG's pixel size and colour components from its start-of-frame marker.
 * Returns null for anything that is not a baseline/progressive JPEG.
 */
export function readJpegInfo(
  bytes: Uint8Array,
): Omit<JpegPage, 'bytes'> | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    // Standalone markers carry no length.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      const components = bytes[i + 9];
      if (width > 0 && height > 0 && [1, 3, 4].includes(components)) {
        return { width, height, components };
      }
      return null;
    }
    i += 2 + length;
  }
  return null;
}

/** PDF points are 1/72 inch; a page's long side is set to A4's 842 so the file prints sensibly. */
const LONG_SIDE_POINTS = 842;

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

const COLOR_SPACE: Record<number, string> = {
  1: '/DeviceGray',
  3: '/DeviceRGB',
  4: '/DeviceCMYK',
};

/** One PDF with one page per JPEG, in order. Throws when no page is given. */
export function buildPdf(pages: JpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error('A PDF needs at least one page');

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? ascii(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Objects: 1 catalog, 2 page tree, then (page, content, image) × n.
  const pageIds = pages.map((_, index) => 3 + index * 3);
  startObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObject(2);
  push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds
      .map(id => `${id} 0 R`)
      .join(' ')}] >>\nendobj\n`,
  );

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const scale = LONG_SIDE_POINTS / Math.max(page.width, page.height);
    const width = Math.max(1, Math.round(page.width * scale));
    const height = Math.max(1, Math.round(page.height * scale));

    startObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
    startObject(contentId);
    push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    );

    startObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace ${
          COLOR_SPACE[page.components] ?? '/DeviceRGB'
        } /BitsPerComponent 8 ` +
        // CMYK JPEGs from Adobe tools are stored inverted.
        `${page.components === 4 ? '/Decode [1 0 1 0 1 0 1 0] ' : ''}` +
        `/Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    push(page.bytes);
    push('\nendstream\nendobj\n');
  });

  const objectCount = 2 + pages.length * 3;
  const xrefAt = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${
      objectCount + 1
    } /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
