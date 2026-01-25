import type { PropsWithChildren } from "react";

export const Columns = (props: PropsWithChildren) => {
	return <div className="flex gap-1 [&>_*]:min-w-0 [&>_*]:flex-1 [&_img]:m-0! [&_p]:m-0!">{props.children}</div>;
};

export const Column = (props: PropsWithChildren) => {
	return props.children;
};
