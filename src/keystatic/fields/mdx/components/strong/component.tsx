import { mark } from "@keystatic/core/content-components";
import { Bold } from "lucide-react";

// TODO : strong, em, del, sup, sub 추가
export const strong = mark({
	label: "굵게",
	icon: <Bold />,
	schema: {},
	tag: "strong",
});
