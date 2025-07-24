import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import remarkBreaks from "remark-breaks";

interface MDXContentProps {
  source: string;
  options?: MDXRemoteProps["options"];
}

// 기본 rehype-pretty-code 설정
const defaultPrettyCodeOptions = {
  theme: "github-dark",
  keepBackground: false,
  defaultLang: "tsx",
};

// 기본 MDX 옵션
const defaultMdxOptions: NonNullable<MDXRemoteProps["options"]> = {
  mdxOptions: {
    remarkPlugins: [remarkBreaks],
    rehypePlugins: [[rehypePrettyCode, defaultPrettyCodeOptions]],
  },
};

export default function MDXContent({ source, options }: MDXContentProps) {
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

  return <MDXRemote source={source} options={mergedOptions} />;
}
