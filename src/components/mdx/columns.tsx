import { columnsGridTemplate, parseColumnWidths } from "@monti-cms/blocks/columns";
import { Children, type CSSProperties, type PropsWithChildren } from "react";

/** 좁은 화면에서는 위아래로 쌓고, 넓은 화면에서는 `widths` 비율(없으면 똑같이)로 나란히 놓는다. */
export const Columns = ({ widths, children }: PropsWithChildren<{ widths?: string }>) => {
	const count = Children.toArray(children).length;
	const style = { "--cms-columns": columnsGridTemplate(parseColumnWidths(widths, count), count) } as CSSProperties;
	return (
		<div
			style={style}
			className="my-6 flex flex-col gap-4 md:grid md:items-start md:gap-6 md:[grid-template-columns:var(--cms-columns)] [&>_*]:min-w-0 [&_img]:m-0! [&_p]:m-0!"
		>
			{children}
		</div>
	);
};

/** 한 단은 한 칸이다. 조각(fragment)으로 두면 단 안의 문단마다 따로 칸이 된다. */
export const Column = (props: PropsWithChildren) => {
	return <div className="flex flex-col gap-3">{props.children}</div>;
};
