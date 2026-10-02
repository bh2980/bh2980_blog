import { annotationConfig } from "@bh2980/cms/annotation/code-block/constants";
import { fromCodeBlockDocumentToCodeFence } from "@bh2980/cms/annotation/code-block/document-to-code-fence";
import type { CodeBlockDocument } from "@bh2980/cms/annotation/code-block/types";
import type { CmsNode } from "@bh2980/cms/mdx";
import { asString } from "./shared";
import type { BlockConverter } from "./types";

const extractCodeValue = (node: CmsNode): string => {
	const value = asString(node.attrs?.value);
	if (value != null) return value;
	const document = node.attrs?.codeDocument;
	if (document && typeof document === "object" && !Array.isArray(document)) {
		return fromCodeBlockDocumentToCodeFence(document as unknown as CodeBlockDocument, annotationConfig).value;
	}
	return "";
};

export const mermaidConverter: BlockConverter = {
	name: "mermaid",
	cmsTypes: ["codeBlock"],
	tiptapTypes: ["cmsMermaid"],
	matches: (node) => asString(node.attrs?.language)?.toLowerCase() === "mermaid",
	isMappable: () => true,
	toTiptap(node) {
		const language = asString(node.attrs?.language) ?? "mermaid";
		const meta = asString(node.attrs?.meta) ?? "";
		const value = extractCodeValue(node);
		return {
			type: "cmsMermaid",
			attrs: {
				value,
				language,
				...(meta ? { meta } : {}),
			},
		};
	},
	toCms(node) {
		const value = asString(node.attrs?.value) ?? "";
		const language = asString(node.attrs?.language) || "mermaid";
		const meta = asString(node.attrs?.meta);
		return [
			{
				type: "codeBlock",
				attrs: {
					language,
					...(meta ? { meta } : {}),
					value,
				},
			},
		];
	},
};

export const chartConverter: BlockConverter = {
	name: "chart",
	cmsTypes: ["codeBlock"],
	tiptapTypes: ["cmsChart"],
	matches: (node) => asString(node.attrs?.language)?.toLowerCase() === "chart",
	isMappable: () => true,
	toTiptap(node) {
		const language = asString(node.attrs?.language) ?? "chart";
		const meta = asString(node.attrs?.meta) ?? "";
		const value = extractCodeValue(node);
		return {
			type: "cmsChart",
			attrs: {
				value,
				language,
				...(meta ? { meta } : {}),
			},
		};
	},
	toCms(node) {
		const value = asString(node.attrs?.value) ?? "";
		const language = asString(node.attrs?.language) || "chart";
		const meta = asString(node.attrs?.meta);
		return [
			{
				type: "codeBlock",
				attrs: {
					language,
					...(meta ? { meta } : {}),
					value,
				},
			},
		];
	},
};

export const mathConverter: BlockConverter = {
	name: "math",
	cmsTypes: ["math"],
	tiptapTypes: ["cmsMath"],
	isMappable: () => true,
	toTiptap(node) {
		const value = asString(node.attrs?.value) ?? "";
		return {
			type: "cmsMath",
			attrs: {
				value,
			},
		};
	},
	toCms(node) {
		const value = asString(node.attrs?.value) ?? "";
		return [
			{
				type: "math",
				attrs: {
					value,
				},
			},
		];
	},
};
