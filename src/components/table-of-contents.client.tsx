"use client";

import { useEffect, useState } from "react";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "../utils";

export const TableOfContents = ({
	contents,
	className,
}: {
	contents: { id: string; level: number; content: string }[];
	className?: ClassNameValue;
}) => {
	const [activeId, setActiveId] = useState<string>();

	const handleTocItemSelect = (
		e: React.MouseEvent<HTMLUListElement, MouseEvent> | React.KeyboardEvent<HTMLUListElement>,
	) => {
		const headingId = (e.target as HTMLAnchorElement)?.dataset.headingId;
		if (!headingId) {
			return;
		}

		const headingElement = document.getElementById(headingId);
		headingElement?.scrollIntoView();
		history.pushState(null, "", `#${headingId}`);
	};

	useEffect(() => {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					setActiveId(entry.target.id);
				}
			});
		});
		contents
			.map((item) => document.getElementById(item.id))
			.forEach((element) => {
				if (!element) return;
				observer.observe(element);
			});

		return () => observer.disconnect();
	}, [contents]);

	return (
		<ul
			className={cn(
				"not-prose flex flex-col gap-2 rounded-md bg-slate-100 p-5 text-slate-500 text-sm",
				"dark:bg-slate-800 dark:text-slate-400",
				className,
			)}
			onClick={handleTocItemSelect}
			onKeyUp={handleTocItemSelect}
		>
			{contents.map((item) => (
				<li
					key={item.id}
					className={cn(
						"cursor-pointer hover:text-accent-foreground",
						activeId === item.id && "font-bold text-slate-600 dark:text-slate-300",
					)}
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
