import { mark } from "@keystatic/core/content-components";
import { Italic } from "lucide-react";

export const em = mark({
	label: "기울임",
	icon: <Italic />,
	schema: {},
	tag: "em",
});
