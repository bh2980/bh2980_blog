import { mark } from "@keystatic/core/content-components";
import { Superscript } from "lucide-react";

export const sup = mark({
	label: "위첨자",
	icon: <Superscript />,
	schema: {},
	tag: "sup",
});
