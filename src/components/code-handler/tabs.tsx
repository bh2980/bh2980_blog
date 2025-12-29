import { Block, CodeBlock, parseProps } from "codehike/blocks";
import { highlight, type RawCode } from "codehike/code";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeTemplate } from "../code";

const Schema = Block.extend({ tabs: z.array(CodeBlock) });
export async function CodeWithTabs(props: unknown) {
	const { tabs }: { tabs: RawCode[] } = parseProps(props, Schema);
	return <CodeTabs tabs={tabs} />;
}

export async function CodeTabs(props: { tabs: RawCode[] }) {
	const { tabs } = props;
	const highlighted = await Promise.all(tabs.map((tab) => highlight(tab, "dark-plus")));
	return (
		<Tabs defaultValue={tabs[0]?.meta} className="dark gap-0 rounded">
			<TabsList className="rounded-b-none bg-[var(--tw-prose-pre-bg)]">
				{tabs.map((tab) => (
					<TabsTrigger key={tab.meta} value={tab.meta}>
						{tab.meta}
					</TabsTrigger>
				))}
			</TabsList>
			{tabs.map((tab, i) => (
				<TabsContent key={tab.meta} value={tab.meta} className="mt-0">
					<CodeTemplate code={highlighted[i]} hideHeader className="rounded-tl-none" />
				</TabsContent>
			))}
		</Tabs>
	);
}
