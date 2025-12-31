// src/keystatic/fields/mdx-components/editor-mermaid-block.tsx
import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { ChartNetwork } from "lucide-react";
import { lazy, Suspense } from "react";

const LazyMermaidBlockNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.MermaidBlockNodeView,
	})),
);

function MermaidBlockNodeViewProxy(props: any) {
	return (
		<Suspense fallback={null}>
			<LazyMermaidBlockNodeView {...props} />
		</Suspense>
	);
}

export const mermaid = block({
	label: "Mermaid 차트",
	icon: <ChartNetwork />,
	schema: {
		chart: fields.text({
			label: "차트 코드",
			multiline: true,
		}),
	},
	NodeView: MermaidBlockNodeViewProxy,
});
