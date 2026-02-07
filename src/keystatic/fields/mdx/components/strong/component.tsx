import { mark } from "@keystatic/core/content-components";
import { Bold } from "lucide-react";

export const strong = mark({
	label: "굵게",
	icon: <Bold />,
	schema: {},
	tag: "strong",
});
