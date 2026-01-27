import { wrapper } from "@keystatic/core/content-components";
import { ChartNetwork } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";

export type MermaidNodeViewProps = PropsWithChildren & {
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
	schema: {},
	NodeView: MermaidBlockNodeViewProxy,
});
