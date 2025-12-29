import { block } from "@keystatic/core/content-components";
import { multiLangCodeBlockField } from "../fields/code-block";
import { CodePreview } from "../fields/code-block/code-preview.client";

export const editorCodeBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: multiLangCodeBlockField({ label: "코드" }),
	},
	ContentView: ({ value }) => (
		<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
			<div className="mb-2 font-bold text-xs text-zinc-500 uppercase">CODE PREVIEW</div>
			{value.codeblock.value ? (
				<CodePreview codeblock={value.codeblock} />
			) : (
				<div className="text-sm text-zinc-400">코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
