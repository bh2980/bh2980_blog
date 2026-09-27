import * as React from "react";
import { boundedTableSpan, MAX_TABLE_COLUMNS } from "@/cms/mdx/table-layout";
import { cn } from "@/utils";

export interface TableProps extends Omit<React.ComponentProps<"table">, "align"> {
	align?: string;
	children?: React.ReactNode;
}

export interface TableRowProps extends React.ComponentProps<"tr"> {
	children?: React.ReactNode;
}

export interface TableCellProps extends Omit<React.ComponentProps<"td">, "align"> {
	header?: boolean | string;
	colspan?: number | string;
	rowspan?: number | string;
	align?: string;
	children?: React.ReactNode;
}

/**
 * 셀 병합(colspan·rowspan)을 지원하는 공개 MDX 표 컴포넌트(v2 C6).
 * 열 정렬(`align="left,center,right"`)을 각 셀의 격자 위치에 맞춰 자동 분배한다.
 */
export function Table({ align, className, children, ...props }: TableProps) {
	const alignments = align ? align.split(",").map((s) => s.trim()) : [];

	// 표 격자에서 각 셀의 열 인덱스를 계산하여 열 정렬을 주입한다.
	const rowList = React.Children.toArray(children);
	const grid: boolean[][] = [];

	const enrichedRows = rowList.map((rowElement, rowIndex) => {
		if (!React.isValidElement(rowElement)) return rowElement;
		const rowChildren = React.Children.toArray((rowElement.props as { children?: React.ReactNode }).children);
		let colIndex = 0;

		const enrichedCells = rowChildren.map((cellElement) => {
			if (!React.isValidElement(cellElement)) return cellElement;
			while (grid[rowIndex]?.[colIndex]) {
				colIndex += 1;
			}
			const cellProps = cellElement.props as TableCellProps;
			const cs = boundedTableSpan(cellProps.colspan ?? cellProps.colSpan, MAX_TABLE_COLUMNS - colIndex);
			const rs = boundedTableSpan(cellProps.rowspan ?? cellProps.rowSpan, rowList.length - rowIndex);

			for (let r = 0; r < rs; r += 1) {
				for (let c = 0; c < cs; c += 1) {
					const targetR = rowIndex + r;
					const targetC = colIndex + c;
					if (!grid[targetR]) grid[targetR] = [];
					grid[targetR][targetC] = true;
				}
			}

			const cellAlign = alignments[colIndex] || undefined;
			colIndex += cs;

			const existingAlign = (cellElement.props as { align?: string } | undefined)?.align;
			return React.cloneElement(cellElement, {
				align: existingAlign ?? cellAlign,
				colspan: cs,
				rowspan: rs,
			} as Record<string, unknown>);
		});

		return React.cloneElement(rowElement, {
			children: enrichedCells,
		} as Record<string, unknown>);
	});

	return (
		<div className="relative my-6 w-full overflow-x-auto">
			<table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props}>
				<tbody>{enrichedRows}</tbody>
			</table>
		</div>
	);
}

export function TableRow({ className, children, ...props }: TableRowProps) {
	return (
		<tr className={cn("border-b transition-colors hover:bg-muted/50", className)} {...props}>
			{children}
		</tr>
	);
}

export function TableCell({
	header,
	colspan,
	rowspan,
	colSpan,
	rowSpan,
	align,
	className,
	children,
	...props
}: TableCellProps) {
	const isHeader = header === true || header === "true" || header === "";
	const Tag = isHeader ? "th" : "td";

	const alignClass =
		align === "center" ? "text-center" : align === "right" ? "text-right" : align === "left" ? "text-left" : undefined;

	return (
		<Tag
			colSpan={Number(colspan ?? colSpan) > 1 ? Number(colspan ?? colSpan) : undefined}
			rowSpan={Number(rowspan ?? rowSpan) > 1 ? Number(rowspan ?? rowSpan) : undefined}
			className={cn(
				"border border-border p-2 align-middle",
				isHeader && "bg-muted/50 font-medium text-foreground",
				alignClass,
				className,
			)}
			{...props}
		>
			{children}
		</Tag>
	);
}
