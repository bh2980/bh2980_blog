import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { Code2 } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";
import { EDITOR_LANG_OPTION, type EditorLang } from "./const";

type NodeSchema = {
	readonly title: string;
	readonly value: string;
	readonly useLineNumber: boolean;
	readonly lang: EditorLang;
};

export type NodeViewProps = PropsWithChildren & {
	value: NodeSchema;
	onChange(value: NodeSchema): void;
	onRemove(): void;
	isSelected: boolean;
};

const LazyCodeBlockNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.CodeblockNodeView,
	})),
);

function CodeBlockNodeViewProxy(props: NodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyCodeBlockNodeView {...props} />
		</Suspense>
	);
}

export const Codeblock = wrapper({
	label: "코드 블럭",
	icon: <Code2 />,
	schema: {
		title: fields.text({ label: "제목" }),
		value: fields.text({ label: "코드" }),
		useLineNumber: fields.checkbox({ label: "라인 번호" }),
		lang: fields.select({
			label: "언어",
			options: EDITOR_LANG_OPTION,
			defaultValue: "typescript",
		}),
	},

	NodeView: CodeBlockNodeViewProxy,
});
