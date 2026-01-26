import { Fragment } from "react/jsx-runtime";
import { codeToTokens } from "shiki";
import type { Annotation } from "@/libs/contents/remark";

type CodeblockProps = {
	code: string;
	annotations: string;
	lang:
		| "bash"
		| "css"
		| "docker"
		| "go"
		| "graphql"
		| "java"
		| "javascript"
		| "json"
		| "jsx"
		| "markdown"
		| "python"
		| "rust"
		| "scss"
		| "sql"
		| "tsx"
		| "typescript"
		| "yaml"
		| "text";
	useLineNumber: boolean;
	title: string;
};

const isOverlapping = (a: [number, number], b: [number, number]) => {
	const startA = a[0] <= a[1] ? a[0] : a[1];
	const endA = a[0] <= a[1] ? a[1] : a[0];
	const startB = b[0] <= b[1] ? b[0] : b[1];
	const endB = b[0] <= b[1] ? b[1] : b[0];

	return !(endA < startB || endB < startA);
};

export const Codeblock = async ({ code, annotations, lang, useLineNumber, title }: CodeblockProps) => {
	const codeStr = JSON.parse(code);
	const annotationList = JSON.parse(annotations) as Annotation[];

	const { tokens: codeblock, ...meta } = await codeToTokens(codeStr, { lang, theme: "dark-plus" });

	const tokens = codeblock.flatMap((line) =>
		line.length === 0
			? [{ content: "", start: -1, end: -1 }]
			: line.map((token) => ({ ...token, start: token.offset, end: token.offset + token.content.length })),
	);

	console.log("tokens", tokens);
	console.log("annotations", annotationList);

	return (
		<pre style={{ whiteSpace: "pre", overflowX: "auto" }}>
			<code>
				{codeblock.map((line, i) => (
					<Fragment key={i}>
						{line.map((t, j) => (
							<span key={j} style={{ color: t.color }}>
								{t.content}
							</span>
						))}
						{"\n"}
					</Fragment>
				))}
			</code>
		</pre>
	);
};
