import { mark } from "@keystatic/core/content-components";
import { Strikethrough } from "lucide-react";

export const del = mark({
	label: "취소선",
	icon: <Strikethrough />,
	schema: {},
	tag: "del",
});
