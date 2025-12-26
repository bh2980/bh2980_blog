import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import { cn } from "@/utils/cn";

interface MDXContentProps {
	source: string;
	options?: MDXRemoteProps["options"];
	className?: string;
}

export default function MDXContent({ source, options, className }: MDXContentProps) {
	return (
		<MDXRemote
			source={source}
			options={options}
			components={{
				wrapper: ({ children }) => <div className={cn("prose dark:prose-invert", className)}>{children}</div>,
			}}
		/>
	);
}
