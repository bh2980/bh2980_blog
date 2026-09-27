import type { CmsJsonValue, CmsNode } from "../../../mdx";
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
		return (
			children.length > 0 &&
			children.every((child) => child.type !== "Tab" && child.type !== "Column" && ctx.isMappableBlock(child))
		);
	},
	toTiptap(node, ctx) {
		const attrs = node.attrs ?? {};
		const values = Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "name" && key !== "attributes"));
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
		return [
			{
				type: cmsType,
				attrs: { ...values, name: cmsType, attributes },
				content: (node.content ?? []).flatMap(ctx.tiptapBlockToCms),
			},
		];
	},
}));
