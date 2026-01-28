import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { Code2 } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";
import { EDITOR_LANG_OPTIONS, type EditorCodeLang } from "./constants";

type CodeBlockSchema = {
	readonly meta: string;
	readonly useLineNumber: boolean;
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
		meta: fields.text({ label: "meta", defaultValue: `title=""` }),
		useLineNumber: fields.checkbox({ label: "줄 번호 사용" }),
		lang: fields.select({
			label: "언어",
			options: EDITOR_LANG_OPTIONS,
			defaultValue: "ts-tags",
		}),
	},

	NodeView: CodeBlockNodeViewProxy,
});
