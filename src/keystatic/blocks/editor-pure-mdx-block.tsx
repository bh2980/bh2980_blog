import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { CodeBlock } from "../fields/code-block/ui";

export const editorPureMdxBlock = block({
	label: "MDX",
	schema: { source: fields.text({ label: "source", multiline: true }) },
	ContentView: (props) => (
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
			{props.value.source ? (
				<CodeBlock codeblock={{ value: props.value.source, lang: "mdx", meta: "" }} />
			) : (
				<div style={{ color: "#999", fontSize: "14px" }}>코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
