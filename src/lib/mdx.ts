// 코드 블록에서 텍스트 추출하는 유틸리티 함수
export const extractCodeText = (children: any): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(extractCodeText).join("");
  }
  if (children?.props?.children) {
    return extractCodeText(children.props.children);
  }
  return "";
};
