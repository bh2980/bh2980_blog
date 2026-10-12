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
		<TabsRoot defaultValue={tabDefault} className="my-6 w-full gap-0">
			{/* 글자 탭: 고른 탭에만 밑줄을 긋고, 내용은 상자 없이 아래에 놓는다 */}
			<TabsList variant="line" className="h-auto w-full justify-start gap-5 rounded-none border-b p-0">
				{childrenArray.map((child) => (
					<TabsTrigger
						key={child.props.label}
						value={child.props.label}
						className="flex-none rounded-none border-0 px-0 pt-0 pb-2 font-normal text-muted-foreground after:bottom-[-1px]! after:h-px! data-active:text-foreground"
					>
						{child.props.label}
					</TabsTrigger>
				))}
			</TabsList>
			<div className="pt-4 [&_pre]:my-0">{children}</div>
		</TabsRoot>
	);
};

export const Tab = (props: PropsWithChildren & { label: string }) => (
	<TabsContent value={props.label}>{props.children}</TabsContent>
);
