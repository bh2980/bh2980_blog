import { codeToTokens } from "shiki";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import {
	buildAnnotatedLinesFromTokens,
	tokenizeAnnotationsFromTokens,
	DEFAULT_ANNOTATION_CONFIG,
	type AnnotationConfig,
	type CodeLanguage,
} from "./code-block.libs";

export const tokenizeAnnotatedCode = async ({
	code,
	lang,
	annotationList,
	annotationConfig,
}: {
	code: string;
	lang: CodeLanguage;
	annotationList: Annotation[];
	annotationConfig: AnnotationConfig;
}) => {
	const { tokens: codeblock, ...tokenMeta } = await codeToTokens(code, { lang, theme: "dark-plus" });
	const tokenized = tokenizeAnnotationsFromTokens({
		code,
		codeblock,
		annotationList,
		annotationConfig,
	});

	return {
		tokenMeta,
		...tokenized,
	};
};

export const buildAnnotatedLines = async ({
	code,
	lang,
	annotationList,
	useLineNumber,
	annotationConfig = DEFAULT_ANNOTATION_CONFIG,
}: {
	code: string;
	lang: CodeLanguage;
	annotationList: Annotation[];
	useLineNumber: boolean;
	annotationConfig?: AnnotationConfig;
}) => {
	const { tokens: codeblock, ...tokenMeta } = await codeToTokens(code, { lang, theme: "dark-plus" });
	const annotated = buildAnnotatedLinesFromTokens({
		code,
		codeblock,
		annotationList,
		useLineNumber,
		annotationConfig,
	});

	return {
		tokenMeta,
		...annotated,
	};
};
