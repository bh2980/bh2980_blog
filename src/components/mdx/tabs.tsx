import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import { TabsContent, TabsList, Tabs as TabsRoot, TabsTrigger } from "../ui/tabs";

export const Tabs = ({ children, defaultValue }: PropsWithChildren & { defaultValue?: string }) => {
	const childrenArray = Children.toArray(children).filter((child): child is ReactElement<{ label: string }> => {
		if (!isValidElement(child)) return false;

		const props = (child as ReactElement<{ label?: unknown }>).props;
		return props.label != null;
	});

	const hasValidFirstTab = childrenArray.length > 0 && typeof childrenArray[0].props.label === "string";
	const tabDefault = defaultValue ?? (hasValidFirstTab ? childrenArray[0].props.label : undefined);

	return (
		<TabsRoot defaultValue={tabDefault} className="w-full gap-0">
			<TabsList className="relative rounded-b-none border">
				{childrenArray.map((child) => (
					<TabsTrigger key={child.props.label} value={child.props.label} className="data-[state=active]:border-border!">
						{child.props.label}
					</TabsTrigger>
				))}
				<span className="pointer-events-none absolute right-0 -bottom-1 left-0 inline-block h-1 bg-muted" />
			</TabsList>
			<div className="rounded-b-lg rounded-tr-lg border bg-muted p-1">{children}</div>
		</TabsRoot>
	);
};

export const Tab = (props: PropsWithChildren & { label: string }) => (
	<TabsContent value={props.label}>{props.children}</TabsContent>
);
