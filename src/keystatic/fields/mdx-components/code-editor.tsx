import Prism from "prismjs";
import * as React from "react";
import Editor from "react-simple-code-editor";
import { cn } from "@/utils/cn";

import "prism-themes/themes/prism-vsc-dark-plus.css";

import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-docker";

const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

type Props = {
	lang: string;
	code: string;
	onCodeChange: (next: string) => void;
	onCommit: () => void;
};

export function CodeEditor({ lang, code, onCodeChange, onCommit }: Props) {
	const lineCount = Math.max(1, (code ?? "").split("\n").length);
	const lineNumbersText = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");

	const highlight = React.useCallback(
		(text: string) => {
			if (lang === "text") return escapeHtml(text);
			const grammar = Prism.languages[lang];
			if (!grammar) return escapeHtml(text);
			return Prism.highlight(text, grammar, lang);
		},
		[lang],
	);

	return (
		<div>
			<div className="flex rounded-md border bg-slate-900 text-white">
				<pre
					aria-hidden
					className={cn([
						"!m-0 w-12",
						"!p-5 !pr-3",
						"!text-slate-400 text-right",
						"pointer-events-none select-none",
						"!whitespace-pre",
						"border-white/10 border-r",
						"!font-mono !text-sm !leading-[21px]",
						"!bg-transparent",
					])}
				>
					{lineNumbersText}
				</pre>
				<Editor
					value={code ?? ""}
					onValueChange={(next) => {
						onCodeChange(next);
					}}
					onBlur={onCommit}
					preClassName={cn("!text-[#9cdcfe]", lang !== "text" ? `language-${lang}` : "")}
					highlight={highlight}
					padding={20}
					className="min-h-[200px] w-full font-mono text-sm leading-[21px]"
					textareaClassName="focus:outline-none w-full caret-white"
				/>
			</div>
		</div>
	);
}
