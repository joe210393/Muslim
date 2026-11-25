import { describe, expect, it } from "vitest";
import { detectAttachmentSignature, detectFileSignature } from "./file-policy";

describe("detectAttachmentSignature", () => {
  it("accepts a pdf and an mp4 without treating the video as a document signature", () => {
    const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const mp4 = new Uint8Array(12);
    mp4.set([0x66, 0x74, 0x79, 0x70], 4);
    expect(detectAttachmentSignature(pdf)).toBe("application/pdf");
    expect(detectFileSignature(mp4)).toBeNull();
    expect(detectAttachmentSignature(mp4)).toBe("video/mp4");
  });
});
