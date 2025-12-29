import { block } from "@keystatic/core/content-components";
import { codeBlockField } from "../fields";
import { CodePreview } from "../fields/code-block/code-preview.client";

export const editorPureMdxBlock = block({
	label: "MDX",
	schema: { source: codeBlockField({ label: "source" }) },
	ContentView: (props) => (
		<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
			<div className="mb-2 font-bold text-xs text-zinc-500 uppercase">MDX PREVIEW</div>
			{props.value.source.value ? (
				<CodePreview codeblock={{ value: props.value.source.value, lang: "md", meta: "" }} />
			) : (
				<div className="text-sm text-zinc-400">코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
