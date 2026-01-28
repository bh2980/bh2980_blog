import type { Annotation } from "@/libs/remark/remark-code-block-annotation";

type RangeCollectorAdapter<TNode, TTextNode extends TNode> = {
	isTextNode: (node: TNode) => node is TTextNode;
	getText: (node: TTextNode) => string;
	isLineBreak?: (node: TNode) => boolean;
	getChildren: (node: TNode) => TNode[] | null;
	getAnnotation?: (node: TNode, start: number, end: number) => Annotation | null;
};

export const collectAnnotationRanges = <TNode, TTextNode extends TNode>(
	nodes: TNode[],
	adapter: RangeCollectorAdapter<TNode, TTextNode>,
) => {
	let pos = 0;
	let code = "";
	const annotations: Annotation[] = [];

	const walk = (node: TNode) => {
		if (adapter.isTextNode(node)) {
			const text = adapter.getText(node);
			code += text;
			pos += text.length;
			return;
		}

		if (adapter.isLineBreak?.(node)) {
			code += "\n";
			pos += 1;
			return;
		}

		const children = adapter.getChildren(node);
		if (!children) return;

		const start = pos;
		for (const child of children) {
			walk(child);
		}
		const end = pos;

		if (start >= end) return;

		const annotation = adapter.getAnnotation?.(node, start, end);
		if (annotation) annotations.push(annotation);
	};

	for (const node of nodes) {
		walk(node);
	}

	return { code, annotations };
};
