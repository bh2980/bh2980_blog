import { ReactNode } from "react";
import { visit } from "unist-util-visit";

export const remarkMermaidToComponent = () => {
  return (tree: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    visit(tree, "code", (node: any, index: number | undefined, parent: any) => {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      if (
        node &&
        node.type === "code" &&
        node.lang === "mermaid" &&
        parent &&
        typeof index === "number"
      ) {
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
