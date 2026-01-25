import { fields } from "@keystatic/core";
import { repeating, wrapper } from "@keystatic/core/content-components";
import { AppWindow } from "lucide-react";
import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

export const Tabs = repeating({
	label: "Tabs",
	icon: <AppWindow />,
	children: ["Tab"],
	validation: { children: { min: 2, max: 8 } },
	schema: {
		defaultValue: fields.text({ label: "기본 탭 value (비우면 첫 탭)" }),
	},
});

export type TabNodeViewProps = {
	value: { readonly label: string };
	onChange(value: { readonly label: string }): void;
	onRemove(): void;
	isSelected: boolean;
	children: ReactNode;
};

const LazyTabNodeView = lazy<ComponentType<TabNodeViewProps>>(() =>
	import("./node-view.client").then((m) => ({
		default: m.TabNodeView,
	})),
);

function LazyTabNodeViewProxy(props: TabNodeViewProps) {
	return (
		<Suspense fallback={null}>
			<LazyTabNodeView {...props} />
		</Suspense>
	);
}

export const Tab = wrapper({
	label: "Tab",
	forSpecificLocations: true,
	schema: {
		label: fields.text({
			label: "탭 이름",
			defaultValue: "Tab",
			validation: { isRequired: true },
		}),
	},
	NodeView: LazyTabNodeViewProxy,
});
