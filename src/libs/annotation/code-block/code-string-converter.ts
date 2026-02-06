import type { Code } from "mdast";
import type { AnnotationConfig, CodeBlockDocument } from "./types";

export const buildCodeBlockDocumentFromCodeFence = (
	_codeNode: Code,
	_annotationConfig: AnnotationConfig,
): CodeBlockDocument => {
	throw new Error("Not implemented");
};

export const composeCodeFenceFromCodeBlockDocument = (
	_document: CodeBlockDocument,
	_annotationConfig: AnnotationConfig,
): Code => {
	throw new Error("Not implemented");
};

