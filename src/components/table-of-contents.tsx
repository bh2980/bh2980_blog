"use client";

import type { ClassNameValue } from "tailwind-merge";
import { cn } from "../utils";

export const TableOfContents = ({
	contents,
	className,
}: {
	contents: { id: string; level: number; content: string }[];
	className?: ClassNameValue;
}) => {
	const scrollTrigger = (e: React.MouseEvent<HTMLUListElement, MouseEvent> | React.KeyboardEvent<HTMLUListElement>) => {
		const headingId = (e.target as HTMLAnchorElement)?.dataset.headingId;
		if (!headingId) {
			return;
		}

		const headingElement = document.getElementById(headingId);
		headingElement?.scrollIntoView();
		history.pushState(null, "", `#${headingId}`);
	};
	return (
		<ul
			className={cn(
				"not-prose flex flex-col gap-2 rounded-md bg-muted p-5 text-muted-foreground text-sm [&_li]:hover:text-accent-foreground",
				className,
			)}
			onClick={scrollTrigger}
			onKeyUp={scrollTrigger}
		>
			{contents.map((item) => (
				<li
					key={item.id}
					style={{
						marginLeft: `${item.level * 12}px`,
					}}
					data-heading-id={item.id}
				>
					{item.content}
				</li>
			))}
		</ul>
	);
};
