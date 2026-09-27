import type { CmsJsonValue } from "../../mdx";
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
	toTiptap: (node, ctx) => ({
		type: "table",
		...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align } } : {}),
		content: (node.content ?? []).map((row, rowIndex) => ({
			type: "tableRow",
			content: (row.content ?? []).map((cell) => {
				const hasMerges = (node.content ?? []).some((r) =>
					(r.content ?? []).some((c) => Number(c.attrs?.colspan ?? 1) > 1 || Number(c.attrs?.rowspan ?? 1) > 1),
				);
				const isHeader =
					cell.attrs?.header === true || (!hasMerges && cell.attrs?.header === undefined && rowIndex === 0);
				const colspan = Number(cell.attrs?.colspan ?? 1);
				const rowspan = Number(cell.attrs?.rowspan ?? 1);
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
	}),
	toCms: (node, ctx) => {
		const rows = node.content ?? [];
		// 병합 셀이 있는지 확인한다. 병합 셀이 있으면 header 속성을 유지하고, 없으면 GFM 규칙을 따른다.
		const hasMerges = rows.some((row) =>
			(row.content ?? []).some((cell) => {
				const cs = Number(cell.attrs?.colspan ?? 1);
				const rs = Number(cell.attrs?.rowspan ?? 1);
				return cs > 1 || rs > 1;
			}),
		);

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
						// 병합이 있는 표에서는 머리글 셀에 header를 명시한다(행 번호 무관).
						// 병합이 없는 표는 GFM 첫 행이 자연스럽게 머리글이 되므로 속성을 비워 기존 바이트를 보존한다.
						if (hasMerges && isHeader) attrs.header = true;

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
