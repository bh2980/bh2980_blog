import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { ChartNetwork } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";

export type MermaidNodeViewProps = PropsWithChildren & {
	value: {
		readonly id: string;
	};
	onChange(value: { readonly id: string }): void;
	onRemove(): void;
	isSelected: boolean;
};

const LazyMermaidBlockNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.MermaidBlockNodeView,
	})),
);

function MermaidBlockNodeViewProxy(props: MermaidNodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyMermaidBlockNodeView {...props} />
		</Suspense>
	);
}

export const EDITOR_MERMAID_NAME = "Mermaid";

export const EditorMermaid = wrapper({
	label: "Mermaid 차트",
	icon: <ChartNetwork />,
	schema: {
		id: fields.text({ label: "코드블럭 ID" }),
		lang: fields.text({ label: "언어", defaultValue: "mermaid" }),
	},
	NodeView: MermaidBlockNodeViewProxy,
});
