import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import CopyButton from "./CopyButton";
import { extractCodeText, remarkMermaidToComponent } from "@/lib/mdx";
import rehypePrettyCode from "rehype-pretty-code";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";

// 기본 rehype-pretty-code 설정
const defaultPrettyCodeOptions = {
  theme: "github-dark",
  keepBackground: false,
  defaultLang: "tsx",
};

// 기본 MDX 옵션
const defaultMdxOptions: NonNullable<MDXRemoteProps["options"]> = {
  mdxOptions: {
    remarkPlugins: [remarkBreaks, remarkGfm, remarkMermaidToComponent],
    rehypePlugins: [[rehypePrettyCode, defaultPrettyCodeOptions]],
  },
};

interface MDXContentProps {
  source: string;
  options?: MDXRemoteProps["options"];
  className?: string;
}

export default function MDXContent({
  source,
  options,
  className,
}: MDXContentProps) {
  // 전달받은 옵션과 기본 옵션을 병합
  const mergedOptions = {
    ...defaultMdxOptions,
    ...options,
    mdxOptions: {
      ...defaultMdxOptions.mdxOptions,
      ...options?.mdxOptions,
      rehypePlugins: [
        ...(defaultMdxOptions.mdxOptions?.rehypePlugins || []),
        ...(options?.mdxOptions?.rehypePlugins || []),
      ],
    },
  };

  return (
    <MDXRemote
      source={source}
      options={mergedOptions}
      components={{
        wrapper: ({ children }) => <div className={className}>{children}</div>,
        pre: ({ children, ...props }) => {
          const code = extractCodeText(children);

          return (
            <div className="relative group">
              <pre {...props} className="relative">
                {children}
              </pre>
              <CopyButton code={code} />
            </div>
          );
        },
        mermaid: Mermaid,
        Mermaid,
      }}
    />
  );
}
