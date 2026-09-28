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
	/** Table이 격자 위치로 채운다. 양 끝 열은 GFM 표처럼 바깥 여백을 두지 않는다. */
	firstColumn?: boolean;
	lastColumn?: boolean;
	/** 머리글 행(thead) 안의 셀이다. */
	inHead?: boolean;
	children?: React.ReactNode;
}

/**
 * 셀 병합(colspan·rowspan)을 지원하는 공개 MDX 표 컴포넌트(v2 C6).
 * 열 정렬(`align="left,center,right"`)을 각 셀의 격자 위치에 맞춰 자동 분배한다.
 */
const isHeaderValue = (header: unknown) => header === true || header === "true" || header === "";

type PlacedCell = { element: React.ReactElement; colIndex: number; colSpan: number; rowSpan: number };

export function Table({ align, widths, className, children, ...props }: TableProps) {
	const alignments = align ? align.split(",").map((s) => s.trim()) : [];

	// 표 격자에서 각 셀의 열 위치를 먼저 계산한다. 열 정렬과 양 끝 열 여백이 이 위치를 쓴다.
	const rowList = React.Children.toArray(children);
	const grid: boolean[][] = [];

	const placedRows = rowList.map((rowElement, rowIndex) => {
		if (!React.isValidElement(rowElement)) return { row: rowElement, cells: null, isHeader: false };
		const rowChildren = React.Children.toArray((rowElement.props as { children?: React.ReactNode }).children);
		let colIndex = 0;
		const cells = rowChildren.map((cellElement) => {
			if (!React.isValidElement(cellElement)) return cellElement;
			while (grid[rowIndex]?.[colIndex]) {
				colIndex += 1;
			}
			const cellProps = cellElement.props as TableCellProps;
			const colSpan = boundedTableSpan(cellProps.colspan ?? cellProps.colSpan, MAX_TABLE_COLUMNS - colIndex);
			const rowSpan = boundedTableSpan(cellProps.rowspan ?? cellProps.rowSpan, rowList.length - rowIndex);
			for (let r = 0; r < rowSpan; r += 1) {
				for (let c = 0; c < colSpan; c += 1) {
					if (!grid[rowIndex + r]) grid[rowIndex + r] = [];
					grid[rowIndex + r][colIndex + c] = true;
				}
			}
			const placed: PlacedCell = { element: cellElement, colIndex, colSpan, rowSpan };
			colIndex += colSpan;
			return placed;
		});
		const isHeader =
			rowIndex === 0 &&
			cells.every(
				(cell) =>
					typeof cell === "object" &&
					cell !== null &&
					"colIndex" in cell &&
					isHeaderValue((cell.element.props as TableCellProps).header),
			);
		return { row: rowElement, cells, isHeader };
	});

	const columnCount = Math.max(0, ...grid.map((row) => row.length));
	// 첫 행이 모두 머리글이고 아래로 병합되지 않으면 GFM 표처럼 thead에 둔다(같은 prose 스타일).
	const headRow = placedRows[0];
	const hasHead =
		!!headRow?.isHeader &&
		!!headRow.cells?.every(
			(cell) => typeof cell === "object" && cell !== null && "rowSpan" in cell && cell.rowSpan === 1,
		);

	const enrichedRows = placedRows.map(({ row, cells, isHeader }) => {
		if (!cells || !React.isValidElement(row)) return row;
		const enrichedCells = cells.map((cell) => {
			if (typeof cell !== "object" || cell === null || !("colIndex" in cell)) return cell;
			const { element, colIndex, colSpan, rowSpan } = cell;
			const cellProps = element.props as TableCellProps;
			// 그룹 전체가 아닌 현재 셀의 열·행에만 연결한다. colspan·rowspan은 HTML의 머리글 배정이 처리한다.
			const scope = isHeaderValue(cellProps.header) ? (cellProps.scope ?? (isHeader ? "col" : "row")) : cellProps.scope;
			return React.cloneElement(element, {
				align: cellProps.align ?? (alignments[colIndex] || undefined),
				scope,
				colspan: colSpan,
				rowspan: rowSpan,
				firstColumn: colIndex === 0,
				lastColumn: colIndex + colSpan >= columnCount,
				inHead: hasHead && isHeader,
			} as Record<string, unknown>);
		});
		return React.cloneElement(row, { children: enrichedCells } as Record<string, unknown>);
	});

	// 편집기(prosemirror-tables)와 같게: 모든 열 너비를 알면 합계 폭, 일부만 알면 최소 폭으로 둔다.
	const columnWidths = parseTableWidths(widths);
	const knownWidths = Array.from({ length: columnCount }, (_, index) => columnWidths[index] ?? null);
	const totalWidth = knownWidths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
	const tableStyle: React.CSSProperties | undefined =
		columnWidths.length === 0 || columnCount === 0
			? undefined
			: knownWidths.every((width) => width !== null)
				? { width: totalWidth, maxWidth: "none" }
				: { minWidth: totalWidth };

	// 테두리·배경은 따로 두지 않는다. 기본(GFM) 표와 같은 prose 표 스타일을 그대로 받는다.
	return (
		<div className="relative my-6 w-full overflow-x-auto">
			<table className={cn("my-0", !tableStyle?.width && "w-full", className)} style={tableStyle} {...props}>
				{columnWidths.length > 0 && columnCount > 0 ? (
					<colgroup>
						{knownWidths.map((width, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: 열 위치가 곧 식별자다.
							<col key={index} style={width ? { width } : undefined} />
						))}
					</colgroup>
				) : null}
				{hasHead ? <thead>{enrichedRows[0]}</thead> : null}
				<tbody>{hasHead ? enrichedRows.slice(1) : enrichedRows}</tbody>
			</table>
		</div>
	);
}

export function TableRow({ className, children, ...props }: TableRowProps) {
	return (
		<tr className={className} {...props}>
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
	firstColumn,
	lastColumn,
	inHead,
	className,
	children,
	scope,
	...props
}: TableCellProps) {
	const isHeader = isHeaderValue(header);
	const Tag = isHeader ? "th" : "td";

	const alignClass =
		align === "center"
			? "text-center"
			: align === "right"
				? "text-right"
				: align === "left"
					? "text-left"
					: "text-start";

	return (
		<Tag
			colSpan={Number(colspan ?? colSpan) > 1 ? Number(colspan ?? colSpan) : undefined}
			rowSpan={Number(rowspan ?? rowSpan) > 1 ? Number(rowspan ?? rowSpan) : undefined}
			scope={isHeader ? scope : undefined}
			// prose의 :first-child/:last-child 여백 규칙은 병합된 행에서 실제 열과 어긋난다. 격자 위치로 직접 준다.
			className={cn(
				"p-[0.5714286em] align-middle",
				inHead && "pt-0 align-bottom",
				firstColumn && "pl-0",
				lastColumn && "pr-0",
				isHeader && "font-semibold text-(--tw-prose-headings)",
				alignClass,
				className,
			)}
			{...props}
		>
			{children}
		</Tag>
	);
}
