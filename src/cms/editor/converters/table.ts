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
			content: (row.content ?? []).map((cell) => ({
				// GFM 표의 첫 행은 머리글이다.
				type: rowIndex === 0 ? "tableHeader" : "tableCell",
				content: [{ type: "paragraph", content: ctx.inlineToTiptap(cell.content ?? []) }],
			})),
		})),
	}),
	toCms: (node, ctx) => [
		{
			type: "table",
			...(Array.isArray(node.attrs?.align) ? { attrs: { align: node.attrs.align as CmsJsonValue } } : {}),
			content: (node.content ?? []).map((row) => ({
				type: "tableRow",
				content: (row.content ?? []).map((cell) => {
					// 셀 안의 여러 문단은 GFM 표에 담을 수 없어 줄바꿈으로 잇는다.
					const paragraphs = (cell.content ?? []).map((block) => ctx.inlineToCms(block.content));
					const inline = paragraphs.flatMap((content, index) =>
						index === 0 ? content : [brDirectiveNode(), ...content],
					);
					return { type: "tableCell", content: inline };
				}),
			})),
		},
	],
};
