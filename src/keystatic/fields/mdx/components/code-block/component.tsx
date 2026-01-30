import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { Code2 } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";
import { EDITOR_LANG_OPTIONS, type EditorCodeLang } from "./constants";

type CodeBlockSchema = {
	readonly id: string;
	readonly meta: { readonly title: string; readonly showLineNumbers: boolean };
	readonly lang: EditorCodeLang;
};

export type CodeBlockNodeViewProps = PropsWithChildren & {
	value: CodeBlockSchema;
	onChange(value: CodeBlockSchema): void;
	onRemove(): void;
	isSelected: boolean;
};

const LazyCodeBlockNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.CodeBlockNodeView,
	})),
);

function CodeBlockNodeViewProxy(props: CodeBlockNodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyCodeBlockNodeView {...props} />
		</Suspense>
	);
}

export const EditorCodeBlock = wrapper({
	label: "코드 블럭",
	icon: <Code2 />,
	schema: {
		id: fields.text({ label: "코드블럭 ID" }),
		meta: fields.object({
			title: fields.text({ label: "제목" }),
			showLineNumbers: fields.checkbox({ label: "줄 번호 표시" }),
		}),
		lang: fields.select({
			label: "언어",
			options: EDITOR_LANG_OPTIONS,
			defaultValue: "ts-tags",
		}),
	},

	NodeView: CodeBlockNodeViewProxy,
});
