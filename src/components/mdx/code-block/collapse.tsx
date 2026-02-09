import { ChevronRight } from "lucide-react";
import { Children, type ReactNode } from "react";

const normalizeRestLines = (lines: ReactNode[]) => {
	const first = lines[0];
	if (typeof first !== "string" || !first.startsWith("\n")) {
		return lines;
	}

	const trimmed = first.slice(1);
	if (trimmed.length === 0) {
		return lines.slice(1);
	}

	return [trimmed, ...lines.slice(1)];
};

export const Collapse = ({ children, open }: { children: ReactNode; open?: boolean }) => {
	const childNodes = Children.toArray(children);
	const firstLine = childNodes[0] ?? null;
	const restLines = normalizeRestLines(childNodes.slice(1));

	return (
		<details className="group relative" open={open}>
			<summary className="group relative block cursor-pointer list-none text-left [&::-webkit-details-marker]:hidden">
				<ChevronRight className="absolute top-1 -left-3 h-3 w-3 text-slate-400 transition-transform group-open:rotate-90 dark:text-slate-500" />
				{firstLine}
			</summary>
			{restLines.length > 0 ? <div>{restLines}</div> : null}
		</details>
	);
};
