import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { ChartColumn } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";

export type ChartNodeViewProps = PropsWithChildren & {
	value: {
		readonly id: string;
		readonly lang: string;
	};
	onChange(value: { readonly id: string; readonly lang: string }): void;
	onRemove(): void;
	isSelected: boolean;
};

const LazyChartNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.ChartNodeView,
	})),
);

function ChartNodeViewProxy(props: ChartNodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyChartNodeView {...props} />
		</Suspense>
	);
}

export const EDITOR_CHART_NAME = "Chart";

export const EditorChart = wrapper({
	label: "차트",
	icon: <ChartColumn />,
	schema: {
		id: fields.text({ label: "차트 블럭 ID" }),
		lang: fields.text({ label: "언어", defaultValue: "chart" }),
	},
	NodeView: ChartNodeViewProxy,
});
