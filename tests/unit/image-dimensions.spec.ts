import { describe, it, expect } from "vitest";
import { getImageDimensions } from "@/lib/image-dimensions";

function buildPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  bytes.set(signature, 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false); // IHDR chunk length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[24] = 8; // bit depth
  bytes[25] = 2; // color type (truecolor)
  return bytes;
}

function buildJpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(2 + 2 + 2 + 9);
  bytes[0] = 0xff;
  bytes[1] = 0xd8; // SOI
  bytes[2] = 0xff;
  bytes[3] = 0xc0; // SOF0
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 11, false); // segment length (2 + 1 + 2 + 2 + 1 + 3)
  bytes[6] = 8; // precision
  view.setUint16(7, height, false);
  view.setUint16(9, width, false);
  bytes[11] = 1; // number of components
  bytes[12] = 1; // component id
  bytes[13] = 0x11; // sampling factors
  bytes[14] = 0; // quant table id
  return bytes;
}

describe("getImageDimensions", () => {
  it("reads width/height from a PNG IHDR chunk", () => {
    expect(getImageDimensions(buildPng(1600, 2560))).toEqual({ format: "png", width: 1600, height: 2560 });
  });

  it("reads width/height from a JPEG SOF0 segment", () => {
    expect(getImageDimensions(buildJpeg(1600, 2560))).toEqual({ format: "jpeg", width: 1600, height: 2560 });
  });

  it("returns null for unrecognized data", () => {
    expect(getImageDimensions(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("returns null for a truncated JPEG rather than throwing", () => {
    const truncated = buildJpeg(1600, 2560).slice(0, 6);
    expect(getImageDimensions(truncated)).toBeNull();
  });
});
