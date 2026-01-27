import { codeToTokens } from "shiki";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import {
	buildAnnotationTree,
	buildLineRanges,
	buildPositionedTokens,
	normalizeAnnotations,
	renderAnnotatedLines,
	splitTokensByBoundaries,
	splitTreeByLines,
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
	const normalizedAnnotations = normalizeAnnotations(annotationList, annotationConfig.rules);
	const markAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "mark");
	const inlineAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "inline");
	const blockAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "block");
	const wrapperAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "wrapper");

	const { tokens: codeblock, ...tokenMeta } = await codeToTokens(code, { lang, theme: "dark-plus" });
	const positionedTokens = buildPositionedTokens(codeblock, code);
	const boundaries = new Set<number>();
	for (const annotation of normalizedAnnotations) {
		boundaries.add(annotation.start);
		boundaries.add(annotation.end);
	}
	const splitTokens = splitTokensByBoundaries(positionedTokens, boundaries);
	const tree = buildAnnotationTree(splitTokens, markAnnotations, code.length);
	const lines = splitTreeByLines(tree);
	const lineRanges = buildLineRanges(code);

	return {
		tokenMeta,
		lines,
		lineRanges,
		inlineAnnotations,
		blockAnnotations,
		wrapperAnnotations,
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
	const tokenized = await tokenizeAnnotatedCode({
		code,
		lang,
		annotationList,
		annotationConfig,
	});

	return {
		...tokenized,
		renderedLines: renderAnnotatedLines({
			lines: tokenized.lines,
			lineRanges: tokenized.lineRanges,
			useLineNumber,
			inlineAnnotations: tokenized.inlineAnnotations,
			blockAnnotations: tokenized.blockAnnotations,
			wrapperAnnotations: tokenized.wrapperAnnotations,
			config: annotationConfig,
		}),
	};
};
