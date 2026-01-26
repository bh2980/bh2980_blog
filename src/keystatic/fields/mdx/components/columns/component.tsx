// columns.tsx

import { repeating, wrapper } from "@keystatic/core/content-components";
import { Columns2 } from "lucide-react";

export const Columns = repeating({
	label: "분할",
	icon: <Columns2 />,
	children: ["Column"],
	validation: { children: { min: 2, max: 4 } },
	schema: {},
	ContentView(props) {
		return (
			<div className="[&>span]:inline-flex! [&>span>span]:inline-flex! [&>span>span]:w-full! [&>span]:w-full! [&_div]:m-0! [&_div]:w-full! [&_div]:flex-1!">
				{props.children}
			</div>
		);
	},
});

export const Column = wrapper({
	label: "칼럼",
	forSpecificLocations: true,
	schema: {},
});
