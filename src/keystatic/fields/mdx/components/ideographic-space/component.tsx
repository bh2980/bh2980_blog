import { inline } from "@keystatic/core/content-components";
import { Subscript } from "lucide-react";

export const IdeographicSpace = inline({
	label: "전각 공백",
	icon: <Subscript />,
	schema: {},
	NodeView() {
		return <span className="inline-block h-5 w-3 rounded-xs border border-yellow-500" />;
	},
});
