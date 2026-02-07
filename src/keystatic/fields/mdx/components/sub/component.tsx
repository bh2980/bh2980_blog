import { mark } from "@keystatic/core/content-components";
import { Subscript } from "lucide-react";

export const sub = mark({
	label: "아랫첨자",
	icon: <Subscript />,
	schema: {},
	tag: "sub",
});
