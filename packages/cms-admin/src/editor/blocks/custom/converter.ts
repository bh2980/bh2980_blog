import type { BlockDefinition } from "@bh2980/cms/blocks/define";
import type { CmsJsonValue, CmsNode } from "@bh2980/cms/mdx";
import type { BlockConverter } from "../../converters/types";
import { customNodeName, isContainer } from "./shared";

const hasDynamicAttribute = (node: CmsNode) =>
	Array.isArray(node.attrs?.attributes) &&
	node.attrs.attributes.some(
		(attr) =>
			typeof attr === "object" && attr !== null && !Array.isArray(attr) && ("spread" in attr || "expression" in attr),
	);

/**
 * 사용자 블록 하나의 변환기. 지시자 속성은 노드의 `values`로, 본문은 노드 내용으로 옮긴다. 원래 속성 순서는
 * `originalAttributes`에 두고 저장할 때 되살린다(내장 컨테이너와 같은 방식).
 */
export function customBlockConverter(block: BlockDefinition, all: readonly BlockDefinition[]): BlockConverter {
	const nodeName = customNodeName(block);
	const childComponents = new Set(
		(block.children?.blocks ?? []).flatMap((name) => all.find((candidate) => candidate.name === name)?.component ?? []),
	);
	const converter: BlockConverter = {
		name: block.component,
		cmsTypes: [block.component],
		tiptapTypes: [nodeName],
		isMappable(node, ctx) {
			if (hasDynamicAttribute(node)) return false;
			if (!isContainer(block)) return !node.content?.length;
			const children = node.content ?? [];
			if (childComponents.size > 0) {
				return (
					children.length > 0 &&
					children.every((child) => childComponents.has(child.type) && ctx.isMappableBlock(child))
				);
			}
			return children.length > 0 && children.every((child) => ctx.isMappableBlock(child));
		},
		toTiptap(node, ctx) {
			const attrs = node.attrs ?? {};
			const values = Object.fromEntries(
				Object.entries(attrs).filter(([key]) => key !== "name" && key !== "attributes"),
			);
			return {
				type: nodeName,
				attrs: { values, originalAttributes: attrs.attributes ?? [] },
				...(isContainer(block) ? { content: (node.content ?? []).map((child) => ctx.blockToTiptap(child)) } : {}),
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
					type: block.component,
					attrs: { ...values, name: block.component, attributes },
					content: isContainer(block) ? (node.content ?? []).flatMap(ctx.tiptapBlockToCms) : [],
				},
			];
		},
	};
	return converter;
}
