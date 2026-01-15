import Link from "next/link";
import type { ClassNameValue } from "tailwind-merge";
import { cn } from "../utils";

export const TableOfContents = ({
	contents,
	className,
}: {
	contents: { id: string; level: number; content: string }[];
	className?: ClassNameValue;
}) => {
	return (
		<ul
			className={cn(
				"not-prose flex flex-col gap-2 rounded-md bg-muted p-5 text-muted-foreground text-sm [&_li]:hover:text-accent-foreground",
				className,
			)}
		>
			{contents.map((item) => (
				<li
					key={item.id}
					style={{
						marginLeft: `${item.level * 12}px`,
					}}
				>
					<Link href={`#${item.id}`}>{item.content}</Link>
				</li>
			))}
		</ul>
	);
};
