import { block } from "@keystatic/core/content-components";
import { codeBlockField } from "../fields";
import { CodePreview } from "../fields/code-block/code-preview.client";

export const editorPureMdxBlock = block({
	label: "MDX",
	schema: { source: codeBlockField({ label: "source" }) },
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
				<CodePreview codeblock={{ value: props.value.source.value, lang: "mdx", meta: "" }} />
			) : (
				<div style={{ color: "#999", fontSize: "14px" }}>코드를 입력하면 미리보기가 생성됩니다.</div>
			)}
		</div>
	),
});
