import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "../index";

describe("MDX Image Component Roundtrip & Conversion", () => {
	it("parses <Image mediaId='123' alt='Test' width='60%' align='center' caption='Cap' /> into image node and serializes both mediaId and src", () => {
		const mdx = `<Image mediaId="123e4567-e89b-12d3-a456-426614174000" src="https://media.example.com/pic.png" alt="Test Image" width="60%" align="center" caption="My caption" />\n`;
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		expect(doc.content).toBeDefined();
		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode).toBeDefined();
		expect(imageNode?.attrs?.mediaId).toBe("123e4567-e89b-12d3-a456-426614174000");
		expect(imageNode?.attrs?.src).toBe("https://media.example.com/pic.png");
		expect(imageNode?.attrs?.alt).toBe("Test Image");
		expect(imageNode?.attrs?.width).toBe("60%");
		expect(imageNode?.attrs?.align).toBe("center");
		expect(imageNode?.attrs?.caption).toBe("My caption");

		const serialized = serialize(doc);
		expect(serialized).toContain('mediaId="123e4567-e89b-12d3-a456-426614174000"');
		expect(serialized).toContain('src="https://media.example.com/pic.png"');
		expect(serialized).toContain('alt="Test Image"');
		expect(serialized).toContain('width="60%"');
		expect(serialized).toContain('align="center"');
		expect(serialized).toContain('caption="My caption"');
	});

	it("preserves standard markdown image ![alt](src) when no extra props exist", () => {
		const mdx = `![Simple alt](https://example.com/pic.png)\n`;
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode).toBeDefined();
		expect(imageNode?.attrs?.src).toBe("https://example.com/pic.png");
		expect(imageNode?.attrs?.alt).toBe("Simple alt");

		const serialized = serialize(doc);
		expect(serialized.trim()).toBe("![Simple alt](https://example.com/pic.png)");
	});
});
