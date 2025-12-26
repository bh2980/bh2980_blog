import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";

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
				wrapper: ({ children }) => <div className={className}>{children}</div>,
			}}
		/>
	);
}
