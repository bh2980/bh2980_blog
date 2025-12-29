import type { FormFieldInputProps } from "@keystatic/core";
import Prism from "prismjs";
import Editor from "react-simple-code-editor";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import "prismjs/components/prism-clike";

// 1. 웹 언어
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";

// 2. 마크업/스타일
import "prismjs/components/prism-markup"; // HTML, XML 등을 포함
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-markdown";

// 3. 설정/데이터
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";

// 4. 프로그래밍 언어
import "prismjs/components/prism-python";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";

// 5. 기타
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-docker";

import "prism-themes/themes/prism-vsc-dark-plus.css";

import { cn } from "@/utils/cn";

const EDITOR_LANG_OPTION = [
	{ label: "TypeScript", value: "typescript" },
	{ label: "JavaScript", value: "javascript" },
	{ label: "TSX", value: "tsx" },
	{ label: "JSX", value: "jsx" },

	{ label: "JSON", value: "json" },
	{ label: "YAML", value: "yaml" },
	{ label: "Markdown", value: "markdown" },
	{ label: "HTML", value: "markup" },
	{ label: "CSS", value: "css" },
	{ label: "SCSS", value: "scss" },

	{ label: "Bash", value: "bash" },

	{ label: "Python", value: "python" },
	{ label: "Go", value: "go" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },

	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },

	{ label: "Dockerfile", value: "docker" },
	{ label: "Plain Text", value: "text" },
];

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const CodeEditor = (props: FormFieldInputProps<{ value: string; lang: string; meta?: string }>) => {
	const code = props.value?.value ?? "";
	const lang = props.value?.lang ?? "typescript";

	const lineCount = Math.max(1, code.split("\n").length);
	const lineNumbersText = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");

	return (
		<div className="flex rounded-md border bg-zinc-800">
			<pre
				aria-hidden
				className={cn([
					"top-0 left-0 m-0 w-12",
					"p-5 pr-3",
					"text-right text-zinc-400",
					"pointer-events-none select-none",
					"whitespace-pre",
					"border-white/10 border-r",
					"font-mono",
					"text-sm",
					"leading-[21px]",
				])}
			>
				{lineNumbersText}
			</pre>
			<Editor
				value={code}
				onValueChange={(next) => props.onChange({ ...(props.value ?? { lang, meta: "" }), value: next, lang })}
				preClassName={lang !== "text" ? `language-${lang}` : ""}
				highlight={(text) => {
					if (lang === "text") return escapeHtml(text);
					const grammar = Prism.languages[lang];
					if (!grammar) return escapeHtml(text);
					return Prism.highlight(text, grammar, lang);
				}}
				padding={20}
				className="min-h-[200px] w-full leading-[21px]"
				textareaClassName="focus:outline-none w-full caret-white"
			/>
		</div>
	);
};

export function CodeEditorWithLangSelector(props: FormFieldInputProps<{ value: string; lang: string; meta?: string }>) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex gap-2">
				<NativeSelect
					className="min-w-[200px]"
					value={props.value?.lang ?? ""}
					onChange={(e) => props.onChange({ value: props.value?.value, meta: props.value?.meta, lang: e.target.value })}
				>
					{EDITOR_LANG_OPTION.map((option) => (
						<NativeSelectOption value={option.value} key={option.value}>
							{option.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
				<Input
					value={props.value?.meta ?? ""}
					onChange={(e) => props.onChange({ value: props.value?.value, lang: props.value?.lang, meta: e.target.value })}
					placeholder="ex) main.js"
				/>
			</div>
			<CodeEditor {...props} />
		</div>
	);
}
