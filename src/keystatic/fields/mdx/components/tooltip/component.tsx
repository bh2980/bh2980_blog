import { fields } from "@keystatic/core";
import { mark } from "@keystatic/core/content-components";
import { MessageSquareMoreIcon } from "lucide-react";

export const tooltip = mark({
	label: "툴팁",
	icon: <MessageSquareMoreIcon />,
	schema: {
		content: fields.text({ label: "내용" }),
	},
	className: "underline decoration-dotted underline-offset-4",
});
