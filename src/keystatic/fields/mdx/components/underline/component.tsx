// editor-callout.tsx
import { mark } from "@keystatic/core/content-components";
import { Underline } from "lucide-react";

// TODO : strong, em, del, sup, sub 추가
// TODO : u 태그로 교체
export const underline = mark({
	label: "밑줄",
	icon: <Underline />,
	schema: {},
});
