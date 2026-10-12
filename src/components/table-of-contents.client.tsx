"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "remark-flexible-toc";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "../utils";

const TRIGGER_STADARD_PX = 240;

export const TableOfContents = ({ toc, className }: { toc: TocItem[]; className?: ClassNameValue }) => {
	const [activeId, setActiveId] = useState<string>();

	const handleTocItemSelect = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, headingId: string) => {
		e.preventDefault();

		if (!headingId) {
			return;
		}

		const headingElement = document.getElementById(headingId.slice(1));

		headingElement?.scrollIntoView({ behavior: "smooth", block: "start" });
		history.pushState(null, "", headingId);
	};

	useEffect(() => {
		const findTarget = () => {
			const targetId = toc.reduce((acc, item) => {
				const element = document.getElementById(item.href.slice(1));

				if (!element) return acc;

				if (element.getBoundingClientRect().top < TRIGGER_STADARD_PX) {
					return item.href;
				}

				return acc;
			}, toc[0]?.href ?? "");

			setActiveId(targetId);
		};

		findTarget();

		window.addEventListener("scroll", findTarget);

		return () => window.removeEventListener("scroll", findTarget);
	}, [toc]);

	return (
		<nav className={cn("not-prose", className)}>
			<ul className="flex flex-col gap-2 border-l py-1 pl-4 text-muted-foreground text-sm leading-relaxed">
				{toc.map((item) => (
					<li
						key={item.href}
						className={cn(
							"cursor-pointer transition-colors hover:text-foreground",
							activeId === item.href && "text-primary",
						)}
						style={{
							marginLeft: `${item.depth * 12}px`,
						}}
					>
						<a href={item.href} onClick={(e) => handleTocItemSelect(e, item.href)} className="line-clamp-1">
							{item.value}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
};
