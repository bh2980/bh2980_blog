import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { Sigma } from "lucide-react";
import { lazy, type PropsWithChildren, Suspense } from "react";

export type MathNodeViewProps = PropsWithChildren & {
	value: {
		readonly id: string;
		readonly lang: string;
	};
	onChange(value: { readonly id: string; readonly lang: string }): void;
	onRemove(): void;
	isSelected: boolean;
};

const LazyMathNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.MathNodeView,
	})),
);

function MathNodeViewProxy(props: MathNodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyMathNodeView {...props} />
		</Suspense>
	);
}

export const EDITOR_MATH_NAME = "Math";

export const EditorMath = wrapper({
	label: "수식 블럭",
	icon: <Sigma />,
	schema: {
		id: fields.text({ label: "수식 블럭 ID" }),
		lang: fields.text({ label: "언어", defaultValue: "mdx" }),
	},
	NodeView: MathNodeViewProxy,
});
