// Reads pixel width/height straight from PNG/JPEG file headers, without
// decoding the image. Formats per their own specs:
//   PNG:  ISO/IEC 15948 / W3C PNG spec — an 8-byte signature followed
//         immediately by the IHDR chunk, whose first two 4-byte big-endian
//         fields are always width then height.
//   JPEG: ITU-T T.81 (a.k.a. ISO/IEC 10918-1) — a stream of markers
//         (0xFF + marker byte); the frame markers SOF0-SOF15 (except the
//         DHT/JPG/DAC markers 0xC4/0xC8/0xCC, which share the numeric range
//         but aren't frame headers) carry a 2-byte height then 2-byte width
//         immediately after their own 2-byte length field.
export interface ImageDimensions {
  format: "png" | "jpeg";
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 24) return false;
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (!isPng(bytes)) return null;
  // IHDR must be the first chunk: [8..11]=length [12..15]="IHDR" [16..19]=width [20..23]=height
  const isIhdr = bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
  if (!isIhdr) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { format: "png", width, height };
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
// Markers with no following length field (standalone).
const STANDALONE_MARKERS = new Set([0xd8, 0xd9, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (STANDALONE_MARKERS.has(marker)) continue;
    if (offset + 2 > bytes.length) break;
    const length = view.getUint16(offset, false);
    if (SOF_MARKERS.has(marker)) {
      if (offset + 7 > bytes.length) break;
      const height = view.getUint16(offset + 3, false);
      const width = view.getUint16(offset + 5, false);
      return { format: "jpeg", width, height };
    }
    offset += length;
  }
  return null;
}

export function getImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}
