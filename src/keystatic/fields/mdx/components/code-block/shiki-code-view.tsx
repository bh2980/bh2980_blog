import javascript from "@shikijs/langs/javascript";
import tsTags from "@shikijs/langs/ts-tags";
import tsx from "@shikijs/langs/tsx";
import githubDark from "@shikijs/themes/github-dark";
import { getSingletonHighlighterCore, type TokensResult } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import {
	buildAnnotationTree,
	buildLineRanges,
	buildPositionedTokens,
	DEFAULT_ANNOTATION_CONFIG,
	normalizeAnnotations,
	renderAnnotatedLines,
	splitTokensByBoundaries,
	splitTreeByLines,
} from "./libs";

// 1) 싱글톤 하이라이터
const highlighter = await getSingletonHighlighterCore({
	themes: [githubDark],
	langs: [tsTags, javascript, tsx],
	engine: createJavaScriptRegexEngine(),
});

// alias 정규화(너의 value 정책에 맞춰 최소만)
function normalizeLang(lang: string) {
	const map: Record<string, string> = {
		js: "javascript",
		ts: "typescript",
		lit: "ts-tags",
		txt: "text",
		plain: "text",
	};
	return map[lang] ?? lang;
}

// 2) 필요한 언어만 동적 로드
const LANG_LOADERS: Record<string, () => Promise<any>> = {
	javascript: () => import("@shikijs/langs/javascript"),
	typescript: () => import("@shikijs/langs/typescript"),
	tsx: () => import("@shikijs/langs/tsx"),
	"ts-tags": () => import("@shikijs/langs/ts-tags"),
	// 필요 언어만 계속 추가
};

export async function highlightCode({
	code,
	lang,
	annotationList = [],
	useLineNumber = false,
}: {
	code: string;
	lang: string;
	annotationList?: Annotation[];
	useLineNumber?: boolean;
}) {
	const id = normalizeLang(lang);

	let tokenResult: TokensResult;

	// Shiki는 text를 fallback으로 쓸 수 있음  [oai_citation:5‡Shiki](https://shiki.style/languages?utm_source=chatgpt.com)
	if (id === "text") {
		tokenResult = highlighter.codeToTokens(code, { lang: "text", theme: "github-dark" });
	} else if (!highlighter.getLoadedLanguages().includes(id)) {
		const loader = LANG_LOADERS[id];
		if (!loader) {
			tokenResult = highlighter.codeToTokens(code, { lang: "text", theme: "github-dark" });
		} else {
			const mod = await loader();
			await highlighter.loadLanguage(mod.default ?? mod);
			tokenResult = highlighter.codeToTokens(code, { lang, theme: "github-dark" });
		}
	} else {
		tokenResult = highlighter.codeToTokens(code, { lang, theme: "github-dark" });
	}

	const { tokens: codeblock, ...tokenMeta } = tokenResult;
	const annotationConfig = DEFAULT_ANNOTATION_CONFIG;
	const normalizedAnnotations = normalizeAnnotations(annotationList, annotationConfig.rules);
	const markAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "mark");
	const inlineAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "inline");
	const blockAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "block");
	const wrapperAnnotations = normalizedAnnotations.filter((annotation) => annotation.kind === "wrapper");

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
	const renderedLines = renderAnnotatedLines({
		lines,
		lineRanges,
		useLineNumber,
		inlineAnnotations,
		blockAnnotations,
		wrapperAnnotations,
		config: annotationConfig,
	});

	return { renderedLines, tokenMeta };
}
