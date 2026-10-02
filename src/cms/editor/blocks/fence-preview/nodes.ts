import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FencePreviewNodeView } from "./fence-preview-node-view";

export const CmsMermaidNode = Node.create({
	name: "cmsMermaid",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			value: {
				default: "",
			},
			meta: {
				default: "",
			},
			language: {
				default: "mermaid",
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-cms-mermaid]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-cms-mermaid": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(FencePreviewNodeView);
	},
});

export const CmsChartNode = Node.create({
	name: "cmsChart",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			value: {
				default: "",
			},
			meta: {
				default: "",
			},
			language: {
				default: "chart",
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-cms-chart]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-cms-chart": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(FencePreviewNodeView);
	},
});

export const CmsMathNode = Node.create({
	name: "cmsMath",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			value: {
				default: "",
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-cms-math]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-cms-math": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(FencePreviewNodeView);
	},
});
