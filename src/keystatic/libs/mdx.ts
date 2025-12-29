import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";
import { visit } from "unist-util-visit";

export function remarkCodeWithTabs() {
	return (tree: any) => {
		visit(tree, "mdxJsxFlowElement", (node) => {
			// 1. 대상 컴포넌트 이름 확인 (CodeWithTabs)
			if (node.name !== "CodeWithTabs") return;

			// 2. 'mdx'라는 이름의 속성 찾기
			const mdxAttrIndex = node.attributes.findIndex((attr: any) => attr.name === "mdx");

			if (mdxAttrIndex !== -1) {
				const mdxContent = node.attributes[mdxAttrIndex].value;

				if (typeof mdxContent === "string") {
					// 3. mdx 속성 안의 문자열 내용을 다시 마크다운 노드로 파싱
					const tempTree = fromMarkdown(mdxContent, {
						extensions: [mdxjs()],
						mdastExtensions: [mdxFromMarkdown()],
					});

					// 4. 파싱된 노드들을 컴포넌트의 자식(children)으로 할당
					node.children = tempTree.children;

					// 5. 기존의 mdx 속성은 제거
					node.attributes.splice(mdxAttrIndex, 1);
				}
			}
		});
	};
}

export function remarkCodeWithTooltips() {
	return (tree: any) => {
		visit(tree, "mdxJsxFlowElement", (node) => {
			// 1. 대상 컴포넌트 이름 확인 (CodeWithTabs)
			if (node.name !== "CodeWithTooltips") return;

			// 2. 'mdx'라는 이름의 속성 찾기
			const mdxAttrIndex = node.attributes.findIndex((attr: any) => attr.name === "mdx");

			if (mdxAttrIndex !== -1) {
				const mdxContent = node.attributes[mdxAttrIndex].value;

				if (typeof mdxContent === "string") {
					// 3. mdx 속성 안의 문자열 내용을 다시 마크다운 노드로 파싱
					const tempTree = fromMarkdown(mdxContent, {
						extensions: [mdxjs()],
						mdastExtensions: [mdxFromMarkdown()],
					});

					// 4. 파싱된 노드들을 컴포넌트의 자식(children)으로 할당
					node.children = tempTree.children;

					// 5. 기존의 mdx 속성은 제거
					node.attributes.splice(mdxAttrIndex, 1);
				}
			}
		});
	};
}
