import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CmsImageNodeView } from "./image-node-view";

export interface CmsImageAttributes {
	mediaId?: string;
	src?: string;
	alt?: string;
	width?: string;
	align?: "left" | "center" | "right";
	caption?: string;
}

export const CmsImageNode = Node.create({
	name: "image",
	group: "block",
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			mediaId: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-media-id"),
				renderHTML: (attributes) => (attributes.mediaId ? { "data-media-id": attributes.mediaId } : {}),
			},
			src: {
				default: null,
			},
			alt: {
				default: "",
			},
			width: {
				default: "100%",
			},
			align: {
				default: "center",
			},
			caption: {
				default: "",
			},
			// 장식 표시(`decorative`). 참일 때만 저장한다.
			decorative: {
				default: null,
			},
			// Markdown 이미지의 타이틀(`![alt](src "title")`) 보존용. 화면에는 쓰지 않는다.
			title: {
				default: null,
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "img[src]",
			},
			{
				tag: "figure[data-image-block]",
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ["figure", mergeAttributes(HTMLAttributes, { "data-image-block": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(CmsImageNodeView);
	},
});
