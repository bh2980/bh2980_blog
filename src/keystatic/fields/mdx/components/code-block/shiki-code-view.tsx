import javascript from "@shikijs/langs/javascript";
import tsTags from "@shikijs/langs/ts-tags";
import tsx from "@shikijs/langs/tsx";
import githubDark from "@shikijs/themes/github-dark";
import { getSingletonHighlighterCore, type TokensResult } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import {
	buildAnnotationTree,
	buildPositionedTokens,
	normalizeAnnotations,
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

export async function highlightCode(code: string, lang: string, annotationList: Annotation[] = []) {
	const id = normalizeLang(lang);

	// Shiki는 text를 fallback으로 쓸 수 있음  [oai_citation:5‡Shiki](https://shiki.style/languages?utm_source=chatgpt.com)
	if (id === "text") {
		return highlighter.codeToTokens(code, { lang: "text", theme: "github-dark" });
	}

	if (!highlighter.getLoadedLanguages().includes(id)) {
		const loader = LANG_LOADERS[id];
		if (!loader) {
			return highlighter.codeToTokens(code, { lang: "text", theme: "github-dark" });
		}
		const mod = await loader();
		await highlighter.loadLanguage(mod.default ?? mod);
	}

	const { tokens: codeblock, ...meta } = highlighter.codeToTokens(code, { lang, theme: "github-dark" });
	const positionedTokens = buildPositionedTokens(codeblock, code);
	const boundaries = new Set<number>();
	for (const annotation of annotationList) {
		boundaries.add(annotation.start);
		boundaries.add(annotation.end);
	}
	const splitTokens = splitTokensByBoundaries(positionedTokens, boundaries);
	const normalizedAnnotations = normalizeAnnotations(annotationList);
	const tree = buildAnnotationTree(splitTokens, normalizedAnnotations, code.length);
	const tokens = splitTreeByLines(tree);

	return { tokens, ...meta };
}
