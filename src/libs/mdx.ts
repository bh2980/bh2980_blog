import { ReactNode } from "react";
import { visit } from "unist-util-visit";
import type { Node, Parent } from "unist";

interface MDXNode extends Node {
  name: string;
  value?: string;
  lang?: string;
  attributes?: MDXNode[];
  children?: MDXNode[];
}

interface MDXParent extends Parent {
  children: MDXNode[];
}

export const remarkMermaidToComponent = () => {
  return (tree: MDXNode) => {
    visit(tree, "code", (node: MDXNode, index: number | undefined, parent: MDXParent) => {
      if (node && node.type === "code" && node.lang === "mermaid" && parent && typeof index === "number") {
        const chart = node.value;

        parent.children[index] = {
          type: "mdxJsxFlowElement",
          name: "Mermaid",
          attributes: [
            {
              type: "mdxJsxAttribute",
              name: "chart",
              value: chart,
            },
          ],
          children: [],
        };
      }
    });
  };
};

// 코드 블록에서 텍스트 추출하는 유틸리티 함수
export const extractCodeText = (children: ReactNode): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(extractCodeText).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    const childWithProps = children as { props: { children?: ReactNode } };
    if (childWithProps.props?.children) {
      return extractCodeText(childWithProps.props.children);
    }
  }
  return "";
};
