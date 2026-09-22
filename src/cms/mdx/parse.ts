import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { remarkDemoteUnknownDirectives } from "./remark-directives";

/**
 * CMS 본문 파서. 공개 렌더(`src/components/mdx/mdx-content.tsx`)와 해석이 갈리지 않도록
 * 같은 remark 구성을 쓴다.
 *
 * `remark-directive`는 등록 여부와 무관하게 모든 `:이름`을 directive 노드로 만든다.
 * 그래서 곧바로 {@link remarkDemoteUnknownDirectives}로 **미등록 이름을 본문 텍스트로 되돌린다** —
 * 저장 형식은 directive를 유지해야 하므로 여기서는 MDX 요소 변환(`remarkDirectivesToMdx`)을 쓰지 않는다.
 */
const processor = unified()
	.use(remarkParse)
	.use(remarkMdx)
	.use(remarkGfm)
	.use(remarkMath, { singleDollarTextMath: false })
	.use(remarkDirective)
	.use(remarkDemoteUnknownDirectives);

export const parseMdxAst = (body: string): Root => {
	// 단일 `$` 인라인 수식은 끈다. 본문에 jQuery `$` 같은 기호가 흔해 수식으로 오인되면
	// 공개 렌더러(remarkDisableInlineMath)와 해석이 갈리고 왕복이 깨진다. 블록 `$$` 수식은 유지한다.
	const file = new VFile({ value: body });
	const tree = processor.parse(file);

	// demote는 transformer다. `.parse()`만 호출하면 실행되지 않아 미등록 이름이 directive로 남는다.
	processor.runSync(tree, file);

	return tree as Root;
};
