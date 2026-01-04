import { Block, CodeBlock, parseProps } from "codehike/blocks";
import { highlight, Pre, type RawCode } from "codehike/code";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import z from "zod";
import { cn } from "@/utils";
import {
	CopyButton,
	collapse,
	collapseContent,
	collapseTrigger,
	diff,
	fold,
	lineNumbers,
	mark,
	tooltip,
} from "./code-handler";

export const CODE_THEME = "dark-plus" as const;

export const InlineCode = ({ children }: PropsWithChildren) => {
	return (
		<code className="rounded-sm border bg-slate-100 p-1 before:content-none after:content-none dark:bg-slate-700">
			{children}
		</code>
	);
};

export const CodeTemplate = ({
	code,
	className,
	hideHeader,
	handlers = [],
}: ComponentProps<typeof Pre> & { hideHeader?: boolean }) => (
	<div className={cn("group relative overflow-hidden rounded-lg", className)}>
		{code.meta && !hideHeader && (
			<div className="bg-slate-600 py-2 text-center font-bold text-slate-200 text-sm">{code.meta}</div>
		)}
		<Pre
			className={cn("!my-0 !px-0", code.meta && "rounded-t-none")}
			code={code}
			handlers={[mark, diff, lineNumbers, fold, collapse, collapseContent, collapseTrigger, ...handlers]}
		/>
		<CopyButton text={code.code} className="hidden group-hover:block" />
	</div>
);

export const Code = async ({ codeblock }: { codeblock: RawCode }) => {
	const code = await highlight(codeblock, CODE_THEME);

	return <CodeTemplate code={code} />;
};

const Schema = Block.extend({
	code: CodeBlock,
	tooltips: z.array(Block).optional(),
});

export async function CodeWithTooltips(props: unknown) {
	const { code, tooltips = [] }: { code: RawCode; tooltips: { title: string; children: ReactNode }[] } = parseProps(
		props,
		Schema,
	);
	const highlighted = await highlight(code, "dark-plus");

	highlighted.annotations = highlighted.annotations.map((a) => {
		const tooltip = tooltips.find((t) => t.title === a.query);
		if (!tooltip) return a;
		return {
			...a,
			data: { ...a.data, children: tooltip.children },
		};
	});
	return <CodeTemplate code={highlighted} handlers={[tooltip]} />;
}
