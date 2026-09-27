import * as React from "react";
import { boundedTableSpan, MAX_TABLE_COLUMNS, parseTableWidths } from "@/cms/mdx/table-layout";
import { cn } from "@/utils";

export interface TableProps extends Omit<React.ComponentProps<"table">, "align"> {
	align?: string;
	/** 열 너비(px) 쉼표 목록. 비운 칸은 자동 너비다. */
	widths?: string;
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
const isHeaderValue = (header: unknown) => header === true || header === "true" || header === "";

export function Table({ align, widths, className, children, ...props }: TableProps) {
	const alignments = align ? align.split(",").map((s) => s.trim()) : [];

	// 표 격자에서 각 셀의 열 인덱스를 계산하여 열 정렬을 주입한다.
	const rowList = React.Children.toArray(children);
	const grid: boolean[][] = [];

	const enrichedRows = rowList.map((rowElement, rowIndex) => {
		if (!React.isValidElement(rowElement)) return rowElement;
		const rowChildren = React.Children.toArray((rowElement.props as { children?: React.ReactNode }).children);
		let colIndex = 0;
		const rowIsHeader =
			rowIndex === 0 &&
			rowChildren.every((cell) => React.isValidElement(cell) && isHeaderValue((cell.props as TableCellProps).header));

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
			// 그룹 전체가 아닌 현재 셀의 열·행에만 연결한다. colspan·rowspan은 HTML의 머리글 배정이 처리한다.
			const scope = isHeaderValue(cellProps.header)
				? (cellProps.scope ?? (rowIsHeader ? "col" : "row"))
				: cellProps.scope;
			return React.cloneElement(cellElement, {
				align: existingAlign ?? cellAlign,
				scope,
				colspan: cs,
				rowspan: rs,
			} as Record<string, unknown>);
		});

		return React.cloneElement(rowElement, {
			children: enrichedCells,
		} as Record<string, unknown>);
	});

	// 편집기(prosemirror-tables)와 같게: 모든 열 너비를 알면 합계 폭, 일부만 알면 최소 폭으로 둔다.
	const columnWidths = parseTableWidths(widths);
	const columnCount = Math.max(0, ...grid.map((row) => row.length));
	const knownWidths = Array.from({ length: columnCount }, (_, index) => columnWidths[index] ?? null);
	const totalWidth = knownWidths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
	const tableStyle: React.CSSProperties | undefined =
		columnWidths.length === 0 || columnCount === 0
			? undefined
			: knownWidths.every((width) => width !== null)
				? { width: totalWidth, maxWidth: "none" }
				: { minWidth: totalWidth };

	return (
		<div className="relative my-6 w-full overflow-x-auto">
			<table
				className={cn("caption-bottom border-collapse text-sm", !tableStyle?.width && "w-full", className)}
				style={tableStyle}
				{...props}
			>
				{columnWidths.length > 0 && columnCount > 0 ? (
					<colgroup>
						{knownWidths.map((width, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: 열 위치가 곧 식별자다.
							<col key={index} style={width ? { width } : undefined} />
						))}
					</colgroup>
				) : null}
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
	scope,
	...props
}: TableCellProps) {
	const isHeader = isHeaderValue(header);
	const Tag = isHeader ? "th" : "td";

	const alignClass =
		align === "center" ? "text-center" : align === "right" ? "text-right" : align === "left" ? "text-left" : undefined;

	return (
		<Tag
			colSpan={Number(colspan ?? colSpan) > 1 ? Number(colspan ?? colSpan) : undefined}
			rowSpan={Number(rowspan ?? rowSpan) > 1 ? Number(rowspan ?? rowSpan) : undefined}
			scope={isHeader ? scope : undefined}
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
