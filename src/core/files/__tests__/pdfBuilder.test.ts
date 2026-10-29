/* eslint-disable no-bitwise -- byte-level encoding (base64, JPEG markers) needs shifts and masks */
import {
  base64ToBytes,
  buildPdf,
  bytesToBase64,
  readJpegInfo,
  type JpegPage,
} from '../pdfBuilder';

/** The smallest byte string that reads as a JPEG with the given size (no real image data). */
function fakeJpeg(width: number, height: number, components = 3): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    // APP0 segment (length 16)
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    // SOF0: length 17, precision 8, height, width, components
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    components,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
    0xff,
    0xd9,
  ]);
}

const text = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => String.fromCharCode(byte)).join('');

describe('base64', () => {
  it('round-trips bytes of every length', () => {
    for (let length = 0; length < 12; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 255);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
        Array.from(bytes),
      );
    }
  });

  it('matches a known value', () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1]);
    expect(bytesToBase64(bytes)).toBe('/9j/4AE=');
  });
});

describe('readJpegInfo', () => {
  it('reads the size and colour components', () => {
    expect(readJpegInfo(fakeJpeg(1500, 2000))).toEqual({
      width: 1500,
      height: 2000,
      components: 3,
    });
    expect(readJpegInfo(fakeJpeg(640, 480, 1))?.components).toBe(1);
  });

  it('refuses anything that is not a JPEG', () => {
    expect(readJpegInfo(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegInfo(new Uint8Array(0))).toBeNull();
  });
});

describe('buildPdf', () => {
  const pages: JpegPage[] = [
    { bytes: fakeJpeg(1000, 1400), width: 1000, height: 1400, components: 3 },
    { bytes: fakeJpeg(1400, 1000), width: 1400, height: 1000, components: 3 },
  ];

  it('writes a header, one page per image and an end marker', () => {
    const pdf = text(buildPdf(pages));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('scales each page so its long side is A4 long (842)', () => {
    const pdf = text(buildPdf(pages));
    expect(pdf).toContain('/MediaBox [0 0 601 842]');
    expect(pdf).toContain('/MediaBox [0 0 842 601]');
  });

  it('keeps the JPEG bytes untouched inside the file', () => {
    const bytes = buildPdf(pages);
    const needle = text(pages[0].bytes);
    expect(text(bytes)).toContain(needle);
  });

  it('has a cross-reference table whose offsets point at each object', () => {
    const bytes = buildPdf(pages);
    const pdf = text(bytes);
    const startxref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    const entries = pdf
      .slice(startxref)
      .split('\n')
      .filter((line: string) => /^\d{10} 00000 n $/.test(line));
    expect(entries).toHaveLength(2 + pages.length * 3);
    entries.forEach((entry: string, index: number) => {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(
        `${index + 1} 0 obj`,
      );
    });
  });

  it('declares each image length so a reader finds the stream end', () => {
    const pdf = text(buildPdf([pages[0]]));
    expect(pdf).toContain(`/Length ${pages[0].bytes.length}`);
  });

  it('refuses an empty document', () => {
    expect(() => buildPdf([])).toThrow();
  });
});
