import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import type { CodeBlockDocument } from "@/libs/annotation/code-block/types";
import type { CmsNode } from "../../mdx";
import { asString } from "./shared";
import type { BlockConverter } from "./types";

const codeBlockValue = (node: CmsNode): string => {
	const value = asString(node.attrs?.value);
	if (value != null) return value;
	const document = node.attrs?.codeDocument;
	if (document && typeof document === "object" && !Array.isArray(document)) {
		return fromCodeBlockDocumentToCodeFence(document as unknown as CodeBlockDocument, annotationConfig).value;
	}
	return "";
};

export const codeBlockConverter: BlockConverter = {
	name: "codeBlock",
	cmsTypes: ["codeBlock"],
	tiptapTypes: ["codeBlock"],
	isMappable: () => true,
	toTiptap(node) {
		const language = asString(node.attrs?.language) ?? null;
		const meta = asString(node.attrs?.meta) ?? null;
		const value = codeBlockValue(node);
		return {
			type: "codeBlock",
			attrs: { language, meta },
			content: value.length > 0 ? [{ type: "text", text: value }] : [],
		};
	},
	toCms(node) {
		const value = (node.content ?? []).map((child) => (child?.type === "text" ? (child.text ?? "") : "")).join("");
		const language = asString(node.attrs?.language);
		const meta = asString(node.attrs?.meta);
		return [{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value } }];
	},
};
