import bash from "@shikijs/langs/bash";
import cpp from "@shikijs/langs/cpp";
import csharp from "@shikijs/langs/csharp";
import csv from "@shikijs/langs/csv";
import docker from "@shikijs/langs/docker";
import dotenv from "@shikijs/langs/dotenv";
import go from "@shikijs/langs/go";
import graphql from "@shikijs/langs/graphql";
import html from "@shikijs/langs/html";
import java from "@shikijs/langs/java";
import jsonc from "@shikijs/langs/jsonc";
import kotlin from "@shikijs/langs/kotlin";
import mdx from "@shikijs/langs/mdx";
import mermaid from "@shikijs/langs/mermaid";
import nginx from "@shikijs/langs/nginx";
import postcss from "@shikijs/langs/postcss";
import powershell from "@shikijs/langs/powershell";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import scss from "@shikijs/langs/scss";
import solidity from "@shikijs/langs/solidity";
import sql from "@shikijs/langs/sql";
import svelte from "@shikijs/langs/svelte";
import swift from "@shikijs/langs/swift";
import toml from "@shikijs/langs/toml";
import tsTags from "@shikijs/langs/ts-tags";
import tsx from "@shikijs/langs/tsx";
import vue from "@shikijs/langs/vue";
import yaml from "@shikijs/langs/yaml";
import oneDarkPro from "@shikijs/themes/one-dark-pro";
import { type DecorationItem, getSingletonHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { EDITOR_CODE_BLOCK_THEME } from "@/keystatic/fields/mdx/components/code-block";
import { addMetaToPre, type Meta, replaceToRenderTag } from "./transformers";

export const highlight = (code: string, lang: string, meta: Meta, decorations?: DecorationItem[]) =>
	highlighter.codeToHast(code, {
		lang,
		theme: EDITOR_CODE_BLOCK_THEME,
		decorations,
		transformers: [replaceToRenderTag(), addMetaToPre(code, meta)],
	});

const highlighter = await getSingletonHighlighterCore({
	themes: [oneDarkPro],
	langs: [
		tsTags,
		tsx,
		vue,
		svelte,
		html,
		scss,
		postcss,
		python,
		java,
		kotlin,
		go,
		rust,
		cpp,
		csharp,
		swift,
		solidity,
		jsonc,
		yaml,
		toml,
		sql,
		graphql,
		mdx,
		csv,
		docker,
		nginx,
		bash,
		powershell,
		dotenv,
		mermaid,
	],
	langAlias: {
		typescript: "ts-tags",
		javascript: "ts-tags",
		js: "ts-tags",
		css: "scss",
		"c#": "csharp",
		json: "jsonc",
	},
	engine: createOnigurumaEngine(),
});
