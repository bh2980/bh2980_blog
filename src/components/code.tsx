import { highlight, Pre, type RawCode } from "codehike/code";
import { CopyButton, collapse, collapseContent, collapseTrigger, diff, fold, lineNumbers, mark } from "./code-handler";

export const Code = async ({ codeblock }: { codeblock: RawCode }) => {
	const highlighted = await highlight(codeblock, "dark-plus");

	return (
		<div className="relative overflow-hidden rounded-lg bg-zinc-950">
			{codeblock.meta && <div className="py-2 text-center font-bold text-sm text-zinc-400">{codeblock.meta}</div>}
			<Pre
				className="!m-0 !px-0"
				code={highlighted}
				handlers={[mark, lineNumbers, fold, diff, collapse, collapseContent, collapseTrigger]}
				style={highlighted.style}
			/>
			<CopyButton text={highlighted.code} />
		</div>
	);
};
