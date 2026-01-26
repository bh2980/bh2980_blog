import type { PropsWithChildren } from "react";

export const Columns = (props: PropsWithChildren) => {
	return (
		<div className="flex flex-col items-center gap-1 md:flex-row md:items-start [&>_*]:min-w-0 [&>_*]:flex-1 [&_img]:m-0! [&_p]:m-0!">
			{props.children}
		</div>
	);
};

export const Column = (props: PropsWithChildren) => {
	return props.children;
};
