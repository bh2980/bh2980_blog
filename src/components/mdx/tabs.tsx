import { Children, type PropsWithChildren, type ReactElement } from "react";
import { TabsContent, TabsList, Tabs as TabsRoot, TabsTrigger } from "../ui/tabs";

export const Tabs = ({ children, defaultValue }: PropsWithChildren & { defaultValue?: string }) => {
	const childrenArray = Children.toArray(children) as ReactElement<{ label: string }>[];
	const hasValidFirstTab = childrenArray.length > 0 && typeof childrenArray[0].props.label === "string";

	const tabDefault = defaultValue ?? (hasValidFirstTab ? childrenArray[0].props.label : undefined);

	return (
		<TabsRoot defaultValue={tabDefault} className="gap-0">
			<TabsList className="rounded-b-none">
				{childrenArray.map((child) => (
					<TabsTrigger key={child.props.label} value={child.props.label}>
						{child.props.label}
					</TabsTrigger>
				))}
			</TabsList>
			<div className="rounded-b-lg rounded-tr-lg bg-muted p-1">{children}</div>
		</TabsRoot>
	);
};

export const Tab = (props: PropsWithChildren & { label: string }) => (
	<TabsContent value={props.label}>{props.children}</TabsContent>
);
