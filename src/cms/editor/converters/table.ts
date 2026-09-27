import type { CmsJsonValue } from "../../mdx";
import { boundedTableSpan, hasGfmHeaderLayout, MAX_TABLE_COLUMNS, tableHasMergedCells } from "../../mdx/table-layout";
import { brDirectiveNode } from "./shared";
import type { BlockConverter } from "./types";

export const tableConverter: BlockConverter = {
	name: "table",
	cmsTypes: ["table"],
	tiptapTypes: ["table"],
	// GFM 표는 셀마다 인라인만 담는다.
	isMappable: (node, ctx) =>
		(node.content ?? []).every(
			(row) =>
				row.type === "tableRow" &&
				(row.content ?? []).every(
					(cell) => cell.type === "tableCell" && (cell.content ?? []).every(ctx.isMappableInline),
				),
		),
	toTiptap: (node, ctx) => {
		const rows = node.content ?? [];
		const hasMerges = tableHasMergedCells(node);
		return {
			type: "table",
			...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align } } : {}),
			content: rows.map((row, rowIndex) => ({
				type: "tableRow",
				content: (row.content ?? []).map((cell) => {
					const isHeader =
						cell.attrs?.header === true || (!hasMerges && cell.attrs?.header === undefined && rowIndex === 0);
					const colspan = boundedTableSpan(cell.attrs?.colspan, MAX_TABLE_COLUMNS);
					const rowspan = boundedTableSpan(cell.attrs?.rowspan, rows.length - rowIndex);
					const attrs: Record<string, unknown> = {};
					if (colspan > 1) attrs.colspan = colspan;
					if (rowspan > 1) attrs.rowspan = rowspan;
					return {
						type: isHeader ? "tableHeader" : "tableCell",
						...(Object.keys(attrs).length > 0 ? { attrs } : {}),
						content: [{ type: "paragraph", content: ctx.inlineToTiptap(cell.content ?? []) }],
					};
				}),
			})),
		};
	},
	toCms: (node, ctx) => {
		const rows = node.content ?? [];
		// 병합 셀이 있는지 확인한다. 병합 셀이 있으면 header 속성을 유지하고, 없으면 GFM 규칙을 따른다.
		const hasMerges = tableHasMergedCells(node);
		const explicitHeaders =
			hasMerges ||
			!hasGfmHeaderLayout(rows.map((row) => (row.content ?? []).map((cell) => cell.type === "tableHeader")));

		return [
			{
				type: "table",
				...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align as CmsJsonValue } } : {}),
				content: rows.map((row) => ({
					type: "tableRow",
					content: (row.content ?? []).map((cell) => {
						// 셀 안의 여러 문단은 GFM 표에 담을 수 없어 줄바꿈으로 잇는다.
						const paragraphs = (cell.content ?? []).map((block) => ctx.inlineToCms(block.content));
						const inline = paragraphs.flatMap((content, index) =>
							index === 0 ? content : [brDirectiveNode(), ...content],
						);
						const colspan = Number(cell.attrs?.colspan ?? 1);
						const rowspan = Number(cell.attrs?.rowspan ?? 1);
						const isHeader = cell.type === "tableHeader";
						const attrs: Record<string, CmsJsonValue> = {};
						if (colspan > 1) attrs.colspan = colspan;
						if (rowspan > 1) attrs.rowspan = rowspan;
						// 병합 표는 머리글만, 비GFM 머리글 배치는 모든 셀의 머리글 여부를 명시한다.
						// GFM 첫 행 머리글 표는 속성을 비워 기존 바이트를 보존한다.
						if (hasMerges && isHeader) attrs.header = true;
						else if (explicitHeaders && !hasMerges) attrs.header = isHeader;

						return {
							type: "tableCell",
							...(Object.keys(attrs).length > 0 ? { attrs } : {}),
							content: inline,
						};
					}),
				})),
			},
		];
	},
};
