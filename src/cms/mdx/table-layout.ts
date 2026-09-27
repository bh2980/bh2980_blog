import type { CmsNode } from "./types";

export const MAX_TABLE_COLUMNS = 64;

/** 잘못되거나 과도한 span이 편집기·공개 렌더의 표 격자를 폭주시키지 않게 제한한다. */
export const boundedTableSpan = (value: unknown, max: number): number => {
	const span = Number(value ?? 1);
	return Number.isSafeInteger(span) && span > 0 ? Math.min(span, Math.max(1, max)) : 1;
};

type TableCellLike = { attrs?: Record<string, unknown> | null };
type TableLike = { content?: Array<{ content?: TableCellLike[] }> };

export const tableHasMergedCells = (node: TableLike): boolean =>
	(node.content ?? []).some((row) =>
		(row.content ?? []).some((cell) => Number(cell.attrs?.colspan ?? 1) > 1 || Number(cell.attrs?.rowspan ?? 1) > 1),
	);

/** GFM은 병합 없이 첫 행 전체만 머리글일 때 정확히 표현한다. */
export const hasGfmHeaderLayout = (rows: boolean[][]): boolean =>
	rows.length > 0 && rows.every((row, rowIndex) => row.every((header) => header === (rowIndex === 0)));

const isTrue = (value: unknown) => value === true || value === "true" || value === "";

/** 명시된 머리글 배치가 GFM 규칙과 다른 비병합 표를 판별한다. */
export const hasNonGfmHeaderLayout = (node: CmsNode): boolean => {
	const rows = node.content ?? [];
	const explicit = rows.some((row) => (row.content ?? []).some((cell) => cell.attrs?.header !== undefined));
	return (
		explicit && !hasGfmHeaderLayout(rows.map((row) => (row.content ?? []).map((cell) => isTrue(cell.attrs?.header))))
	);
};

/** micromark directive 라벨과 같은 방식으로 이스케이프되지 않은 대괄호 균형을 확인한다. */
export const hasBalancedLabelBrackets = (value: string): boolean => {
	let depth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (char === "\\") {
			index += 1;
			continue;
		}
		if (char === "[" && ++depth > 32) return false; // micromark 라벨 중첩 한도
		if (char === "]") {
			depth -= 1;
			if (depth < 0) return false;
		}
	}
	return depth === 0;
};
