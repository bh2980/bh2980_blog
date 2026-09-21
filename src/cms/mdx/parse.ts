import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

export const parseMdxAst = (body: string): Root => {
	// 단일 `$` 인라인 수식은 끈다. 본문에 jQuery `$` 같은 기호가 흔해 수식으로 오인되면
	// 공개 렌더러(remarkDisableInlineMath)와 해석이 갈리고 왕복이 깨진다. 블록 `$$` 수식은 유지한다.
	return unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkGfm)
		.use(remarkMath, { singleDollarTextMath: false })
		.parse(body) as Root;
};
