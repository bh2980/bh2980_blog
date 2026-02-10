import { Children, type ReactNode } from "react";
import { cn } from "@/utils/cn";

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

export const collapse = ({ children, open }: { children: ReactNode; open?: boolean }) => {
	const childNodes = Children.toArray(children);
	const firstLine = childNodes[0] ?? null;
	const restLines = normalizeRestLines(childNodes.slice(1));

	return (
		<details className="group relative" open={open}>
			<summary
				className={cn(
					"group relative block cursor-pointer list-none text-left [&::-webkit-details-marker]:hidden",
					"[&_.line]:anno-mark-base [&_.line]:anno-mark:content-['›']",
					"group-open:[&_.line]:anno-mark:rotate-90 group-open:[&_.line]:anno-mark:transition-transform",
				)}
			>
				{firstLine}
			</summary>
			{restLines.length > 0 ? <div>{restLines}</div> : null}
		</details>
	);
};
