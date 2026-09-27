import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ContainerNodeView } from "./view";

/** 자식 노드는 부모 전용 스키마로 제한한다. 본문 컨테이너는 일반 블록을 받는다. */
const parseJsonAttribute = (value: string | null, fallback: Record<string, unknown> | unknown[]) => {
	if (!value) return fallback;
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) === !Array.isArray(fallback)
			? parsed
			: fallback;
	} catch {
		return fallback;
	}
};

const container = (name: string, content: string, group?: string) =>
	Node.create({
		name,
		...(group ? { group } : {}),
		content,
		isolating: true,
		selectable: true,
		draggable: false, // 핸들 오버레이(C1)가 드래그한다. 본문 선택과 경쟁하지 않는다.
		addAttributes() {
			return {
				values: {
					default: {},
					parseHTML: (element) => parseJsonAttribute(element.getAttribute("data-cms-values"), {}),
					renderHTML: (attributes) => ({ "data-cms-values": JSON.stringify(attributes.values ?? {}) }),
				},
				originalAttributes: {
					default: [],
					parseHTML: (element) => parseJsonAttribute(element.getAttribute("data-cms-original-attributes"), []),
					renderHTML: (attributes) => ({
						"data-cms-original-attributes": JSON.stringify(attributes.originalAttributes ?? []),
					}),
				},
			};
		},
		parseHTML() {
			return [{ tag: `div[data-cms-container="${name}"]` }];
		},
		renderHTML({ HTMLAttributes }) {
			return ["div", mergeAttributes(HTMLAttributes, { "data-cms-container": name }), 0];
		},
		addNodeView() {
			return ReactNodeViewRenderer(ContainerNodeView);
		},
	});

export const CmsCalloutNode = container("cmsCallout", "block+", "block");
export const CmsCollapsibleNode = container("cmsCollapsible", "block+", "block");
export const CmsTabsNode = container("cmsTabs", "cmsTab{2,8}", "block");
export const CmsTabNode = container("cmsTab", "block+");
export const CmsColumnsNode = container("cmsColumns", "cmsColumn{2,4}", "block");
export const CmsColumnNode = container("cmsColumn", "block+");
