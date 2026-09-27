import { CodeBlock } from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockView } from "./code-block-view";
import { createCodeBlockHighlightPlugin } from "./highlight-plugin";
import { createCodeBlockKeysPlugin } from "./keys";

export const CmsCodeBlock = CodeBlock.extend({
	name: "codeBlock",

	addAttributes() {
		return {
			...this.parent?.(),
			meta: {
				default: null,
			},
			annotations: {
				default: [],
			},
			annotationsDisabled: {
				default: false,
			},
			raw: { default: null },
			rawLanguage: { default: null },
			cleanCode: { default: null },
			initialAnnotationsJson: { default: null },
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockView);
	},

	addProseMirrorPlugins() {
		return [...(this.parent?.() ?? []), createCodeBlockKeysPlugin(), createCodeBlockHighlightPlugin()];
	},
});
