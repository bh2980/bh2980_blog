import { block } from "@keystatic/core/content-components";
import { codeBlockField } from "..";
import { CodePreview } from "./code-preview.client";

export const editorPureMdxBlock = block({
	label: "MDX",
	schema: { source: codeBlockField({ label: "source" }) },
	ContentView: (props) => (
		<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
			<div className="mb-2 font-bold text-slate-500 text-xs uppercase">MDX PREVIEW</div>
			{props.value.source.value ? (
				<CodePreview codeblock={{ value: props.value.source.value, lang: "md", meta: "" }} />
			) : (
				<div className="text-slate-400 text-sm">코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
