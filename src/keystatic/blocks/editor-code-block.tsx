import { block } from "@keystatic/core/content-components";
import { codeBlockField } from "../fields/code-block";
import { CodeBlock } from "../fields/code-block/ui";

export const editorCodeBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: codeBlockField({ label: "코드" }),
	},
	ContentView: ({ value }) => (
		<div
			style={{
				padding: "1rem",
				border: "1px solid #e1e1e1",
				borderRadius: "8px",
				backgroundColor: "#fafafa",
			}}
		>
			<div
				style={{
					marginBottom: "8px",
					fontWeight: "bold",
					fontSize: "12px",
					color: "#666",
				}}
			>
				CODE PREVIEW
			</div>
			{value.codeblock.value ? (
				<CodeBlock codeblock={value.codeblock} />
			) : (
				<div style={{ color: "#999", fontSize: "14px" }}>코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
