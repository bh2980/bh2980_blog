import { type HighlightedCode, highlight, Pre } from "codehike/code";
import { CopyButton, diff, fold, lineNumbers, mark } from "./code-handler";

export const Code = async ({ codeblock }: { codeblock: HighlightedCode }) => {
	const highlighted = await highlight(codeblock, "dark-plus");

	return (
		<div className="relative bg-zinc-950 rounded-lg overflow-hidden">
			{codeblock.meta && <div className="text-center text-zinc-400 text-sm py-2 font-bold">{codeblock.meta}</div>}
			<Pre className="!m-0 !px-0" code={highlighted} handlers={[mark, lineNumbers, fold, diff]} />
			<CopyButton text={highlighted.code} />
		</div>
	);
};
