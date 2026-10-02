import type { CmsJsonValue, CmsNode } from "@bh2980/cms/mdx";
import type { BlockConverter } from "../../converters/types";

const containerTypes = [
	["Callout", "cmsCallout"],
	["Collapsible", "cmsCollapsible"],
	["Tabs", "cmsTabs"],
	["Tab", "cmsTab"],
	["Columns", "cmsColumns"],
	["Column", "cmsColumn"],
] as const;

export const CONTAINER_CONVERTERS: readonly BlockConverter[] = containerTypes.map(([cmsType, tiptapType]) => ({
	name: cmsType,
	cmsTypes: [cmsType],
	tiptapTypes: [tiptapType],
	isMappable(node, ctx) {
		// JSX spread/표현식·인식 못 하는 자식은 컨테이너 전체를 원문 보존 상자로 남긴다.
		if (
			Array.isArray(node.attrs?.attributes) &&
			node.attrs.attributes.some(
				(attr) =>
					typeof attr === "object" &&
					attr !== null &&
					!Array.isArray(attr) &&
					("spread" in attr || "expression" in attr),
			)
		)
			return false;
		const children = node.content ?? [];
		if (cmsType === "Tabs" || cmsType === "Columns") {
			const expected = cmsType === "Tabs" ? "Tab" : "Column";
			const min = 2;
			const max = cmsType === "Tabs" ? 8 : 4;
			return (
				children.length >= min &&
				children.length <= max &&
				children.every((child) => {
					const childConverter = CONTAINER_CONVERTERS.find((converter) => converter.cmsTypes.includes(child.type));
					return child.type === expected && !!childConverter && childConverter.isMappable(child, ctx);
				})
			);
		}
		// 콜아웃은 본문이 비어도 된다(제목만 있는 콜아웃).
		return (
			(children.length > 0 || cmsType === "Callout") &&
			children.every((child) => child.type !== "Tab" && child.type !== "Column" && ctx.isMappableBlock(child))
		);
	},
	toTiptap(node, ctx) {
		const attrs = node.attrs ?? {};
		const values = Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "name" && key !== "attributes"));
		// 편집기 스키마는 본문 블록이 하나 이상이어야 한다(block+). 빈 콜아웃은 빈 문단 하나로 연다.
		if (cmsType === "Callout" && !node.content?.length)
			return {
				type: tiptapType,
				attrs: { values, originalAttributes: attrs.attributes ?? [] },
				content: [{ type: "paragraph" }],
			};
		return {
			type: tiptapType,
			attrs: { values, originalAttributes: attrs.attributes ?? [] },
			content: (node.content ?? []).map((child) => {
				if (cmsType === "Tabs" || cmsType === "Columns") {
					const childConverter = CONTAINER_CONVERTERS.find((converter) => converter.cmsTypes.includes(child.type));
					if (childConverter) return childConverter.toTiptap(child, ctx);
				}
				return ctx.blockToTiptap(child);
			}),
		};
	},
	toCms(node, ctx): CmsNode[] {
		const values = (node.attrs?.values ?? {}) as Record<string, CmsJsonValue>;
		const original = Array.isArray(node.attrs?.originalAttributes) ? node.attrs.originalAttributes : [];
		const attributes = original
			.filter(
				(attr: unknown): attr is { name: string; value?: CmsJsonValue } =>
					typeof attr === "object" && attr !== null && "name" in attr && typeof attr.name === "string",
			)
			.filter((attr: { name: string }) => values[attr.name] !== undefined)
			.map((attr: { name: string; value?: CmsJsonValue }) => ({ ...attr, value: values[attr.name] }));
		for (const [name, value] of Object.entries(values)) {
			if (value !== undefined && !attributes.some((attr: { name: string }) => attr.name === name))
				attributes.push({ name, value });
		}
		const children = node.content ?? [];
		// 빈 문단만 남은 콜아웃은 본문 없는 콜아웃으로 저장한다(위 toTiptap의 반대).
		const emptyBody =
			cmsType === "Callout" && children.every((child) => child.type === "paragraph" && !child.content?.length);
		return [
			{
				type: cmsType,
				attrs: { ...values, name: cmsType, attributes },
				content: emptyBody ? [] : children.flatMap(ctx.tiptapBlockToCms),
			},
		];
	},
}));
