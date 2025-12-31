import { block } from "@keystatic/core/content-components";
import { multiLangCodeBlockField } from "../code-block";
import { CodePreview } from "../code-block/code-preview.client";

export const editorCodeBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: multiLangCodeBlockField({ label: "코드" }),
	},
	ContentView: ({ value }) => (
		<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
			<div className="mb-2 font-bold text-slate-500 text-xs uppercase">CODE PREVIEW</div>
			{value.codeblock.value ? (
				<CodePreview codeblock={value.codeblock} />
			) : (
				<div className="text-slate-400 text-sm">코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
