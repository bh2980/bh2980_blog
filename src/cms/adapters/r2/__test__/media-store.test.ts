import { describe, expect, it, vi } from "vitest";
import {
	createR2MediaStore,
	detectImageDimensionsAndType,
} from "../media-store";
import type { MediaStore } from "../types";

describe("R2 MediaStore (Unit & Contract)", () => {
	it("detectImageDimensionsAndType detects PNG signatures and dimensions", () => {
		// Minimum valid PNG header: 8-byte signature + 4-byte chunk len + 4-byte 'IHDR' + 4-byte width + 4-byte height
		const buf = new Uint8Array(24);
		buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
		buf.set([0x00, 0x00, 0x00, 0x0d], 8);
		buf.set([0x49, 0x48, 0x44, 0x52], 12);
		// width = 800 (0x0320)
		buf[16] = 0x00;
		buf[17] = 0x00;
		buf[18] = 0x03;
		buf[19] = 0x20;
		// height = 600 (0x0258)
		buf[20] = 0x00;
		buf[21] = 0x00;
		buf[22] = 0x02;
		buf[23] = 0x58;

		const result = detectImageDimensionsAndType(buf);
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe("image/png");
		expect(result?.width).toBe(800);
		expect(result?.height).toBe(600);
	});

	it("detectImageDimensionsAndType rejects non-image or corrupted files", () => {
		const buf = new Uint8Array([1, 2, 3, 4, 5]);
		const result = detectImageDimensionsAndType(buf);
		expect(result).toBeNull();
	});

	it("prepareUpload rejects disallowed mime types like SVG or PDF", async () => {
		const store = createR2MediaStore({
			accountId: "test-acc",
			accessKeyId: "test-key",
			secretAccessKey: "test-sec",
			bucket: "test-bucket",
			endpoint: "https://test.r2.cloudflarestorage.com",
			publicBaseUrl: "https://media.example.com",
		});

		await expect(
			store.prepareUpload({
				stagingKey: "staging/test.svg",
				// @ts-expect-error testing runtime validation
				contentType: "image/svg+xml",
				expiresInSeconds: 600,
			}),
		).rejects.toThrow(/disallowed|unsupported/i);
	});

	it("getPublicUrl constructs canonical URL from finalKey", () => {
		const store = createR2MediaStore({
			accountId: "test-acc",
			accessKeyId: "test-key",
			secretAccessKey: "test-sec",
			bucket: "test-bucket",
			endpoint: "https://test.r2.cloudflarestorage.com",
			publicBaseUrl: "https://media.example.com",
		});

		expect(store.getPublicUrl("media/asset-123.webp")).toBe("https://media.example.com/media/asset-123.webp");
		expect(store.getPublicUrl("/media/asset-123.webp")).toBe("https://media.example.com/media/asset-123.webp");
	});
});
