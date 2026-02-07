import { mark } from "@keystatic/core/content-components";
import { Underline } from "lucide-react";

export const u = mark({
	label: "밑줄",
	icon: <Underline />,
	schema: {},
	tag: "u",
	className: "underline-offset-4",
});
