// src/keystatic/fields/mdx-components/editor-code-block.tsx
import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { Code } from "lucide-react";
import { lazy, Suspense } from "react";
import { EDITOR_LANG_OPTIONS } from "./constants";

const LazyCodeBlockNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.CodeBlockNodeView,
	})),
);

function CodeBlockNodeViewProxy(props: any) {
	return (
		<Suspense fallback={null}>
			<LazyCodeBlockNodeView {...props} />
		</Suspense>
	);
}

export const codeblock = block({
	label: "코드 블럭",
	icon: <Code />,
	schema: {
		codeblock: fields.object({
			lang: fields.select({
				label: "언어",
				defaultValue: "typescript",
				options: EDITOR_LANG_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
			}),
			value: fields.text({ label: "코드", multiline: true }),
			meta: fields.text({ label: "메타데이터" }),
		}),
	},

	NodeView: CodeBlockNodeViewProxy,
});
