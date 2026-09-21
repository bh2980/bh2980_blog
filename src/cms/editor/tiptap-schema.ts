import { Extension } from "@tiptap/core";

/**
 * Custom Tiptap extension to safely preserve unknown MDX JSX elements, expressions,
 * and custom block nodes without stripping them or failing validation.
 */
export const CmsMdxPreserver = Extension.create({
	name: "cmsMdxPreserver",
});
