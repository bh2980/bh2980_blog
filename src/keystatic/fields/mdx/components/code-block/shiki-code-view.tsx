import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import javascript from "@shikijs/langs/javascript";
import jsonc from "@shikijs/langs/jsonc";
import python from "@shikijs/langs/python";
import scss from "@shikijs/langs/scss";
import solidity from "@shikijs/langs/solidity";
import sql from "@shikijs/langs/sql";
import tsTags from "@shikijs/langs/ts-tags";
import tsx from "@shikijs/langs/tsx";
import yaml from "@shikijs/langs/yaml";
import oneDarkPro from "@shikijs/themes/one-dark-pro";
import { getSingletonHighlighterCore, type TokensResult } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import { EDITOR_CODE_BLOCK_THEME } from "./const";
import { buildAnnotatedLinesFromTokens, DEFAULT_ANNOTATION_CONFIG, type EditorCodeLang } from "./libs";

// 1) 싱글톤 하이라이터
const highlighter = await getSingletonHighlighterCore({
	themes: [oneDarkPro],
	langs: [tsTags, javascript, tsx, css, scss, python, solidity, jsonc, yaml, sql, bash],
	engine: createJavaScriptRegexEngine(),
});

// alias 정규화(너의 value 정책에 맞춰 최소만)
function normalizeLang(lang: string) {
	const map: Record<string, string> = {
		js: "javascript",
		ts: "ts-tags",
		typescript: "ts-tags",
		lit: "ts-tags",
		json: "jsonc",
		yml: "yaml",
		dockerfile: "docker",
		md: "mdx",
		txt: "text",
		plain: "text",
	};
	return map[lang] ?? lang;
}

// 2) 필요한 언어만 동적 로드
const LANG_LOADERS: Record<string, () => Promise<any>> = {
	vue: () => import("@shikijs/langs/vue"),
	svelte: () => import("@shikijs/langs/svelte"),
	html: () => import("@shikijs/langs/html"),
	postcss: () => import("@shikijs/langs/postcss"),
	go: () => import("@shikijs/langs/go"),
	rust: () => import("@shikijs/langs/rust"),
	java: () => import("@shikijs/langs/java"),
	kotlin: () => import("@shikijs/langs/kotlin"),
	cpp: () => import("@shikijs/langs/cpp"),
	csharp: () => import("@shikijs/langs/csharp"),
	swift: () => import("@shikijs/langs/swift"),
	toml: () => import("@shikijs/langs/toml"),
	csv: () => import("@shikijs/langs/csv"),
	mdx: () => import("@shikijs/langs/mdx"),
	graphql: () => import("@shikijs/langs/graphql"),
	powershell: () => import("@shikijs/langs/powershell"),
	docker: () => import("@shikijs/langs/docker"),
	nginx: () => import("@shikijs/langs/nginx"),
	dotenv: () => import("@shikijs/langs/dotenv"),
	mermaid: () => import("@shikijs/langs/mermaid"),
	// 기본 언어 외만 필요할 때 추가
};

export async function highlightCode({
	code,
	lang,
	annotationList = [],
	useLineNumber = false,
}: {
	code: string;
	lang: EditorCodeLang;
	annotationList?: Annotation[];
	useLineNumber?: boolean;
}) {
	const id = normalizeLang(lang);

	let tokenResult: TokensResult;

	// Shiki는 text를 fallback으로 쓸 수 있음  [oai_citation:5‡Shiki](https://shiki.style/languages?utm_source=chatgpt.com)
	if (id === "text") {
		tokenResult = highlighter.codeToTokens(code, { lang: "text", theme: EDITOR_CODE_BLOCK_THEME });
	} else if (!highlighter.getLoadedLanguages().includes(id)) {
		const loader = LANG_LOADERS[id];
		if (!loader) {
			tokenResult = highlighter.codeToTokens(code, { lang: "text", theme: EDITOR_CODE_BLOCK_THEME });
		} else {
			const mod = await loader();
			await highlighter.loadLanguage(mod.default ?? mod);
			tokenResult = highlighter.codeToTokens(code, { lang: id, theme: EDITOR_CODE_BLOCK_THEME });
		}
	} else {
		tokenResult = highlighter.codeToTokens(code, { lang: id, theme: EDITOR_CODE_BLOCK_THEME });
	}

	const { tokens: codeblock, ...tokenMeta } = tokenResult;
	const { renderedLines } = buildAnnotatedLinesFromTokens({
		code,
		codeblock,
		annotationList,
		useLineNumber,
		annotationConfig: DEFAULT_ANNOTATION_CONFIG,
	});

	return { renderedLines, tokenMeta };
}
