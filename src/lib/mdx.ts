import { ReactNode } from "react";

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
