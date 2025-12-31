// src/keystatic/fields/mdx-components/editor-code-block.tsx
import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import * as React from "react";

import { EDITOR_LANG_OPTION } from "./editor-code-block.constants";

// 클라 전용 NodeView를 "정적 import"하지 않고 lazy로만 불러오기
const LazyCodeBlockNodeView = React.lazy(() =>
	import("./editor-code-block.client").then((m) => ({
		default: m.CodeBlockNodeView,
	})),
);

function CodeBlockNodeViewProxy(props: any) {
	return (
		<React.Suspense fallback={null}>
			<LazyCodeBlockNodeView {...props} />
		</React.Suspense>
	);
}

export const editorCodeBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: fields.object({
			lang: fields.select({
				label: "언어",
				defaultValue: "typescript",
				options: EDITOR_LANG_OPTION.map((o) => ({ label: o.label, value: o.value })),
			}),
			value: fields.text({ label: "코드", multiline: true }),
			meta: fields.text({ label: "메타데이터" }),
		}),
	},

	NodeView: CodeBlockNodeViewProxy,
});
