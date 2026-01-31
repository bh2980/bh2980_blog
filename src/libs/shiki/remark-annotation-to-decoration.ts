import type { Code, Root } from "mdast";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import {
	type ClassLineAnnotation,
	type LineAnnotation,
	parseCodeToAnnotationLines,
	parseFenceMeta,
	type RenderLineAnnotation,
} from "@/keystatic/libs/parse-annotations";
import type { AnnotationConfig } from "@/keystatic/libs/serialize-annotations";

const isDecAnnotation = (anno: LineAnnotation): anno is ClassLineAnnotation => anno.tag === "dec" && "class" in anno;
const isMarkAnnotation = (anno: LineAnnotation): anno is RenderLineAnnotation =>
	anno.tag === "mark" && "render" in anno;

const buildDecDecoration = (lineNumber: number, anno: ClassLineAnnotation): DecorationItem => ({
	start: { line: lineNumber, character: anno.range.start },
	end: { line: lineNumber, character: anno.range.end },
	properties: { class: anno.class },
});

const buildMarkDecoration = (lineNumber: number, anno: RenderLineAnnotation): DecorationItem => {
	const dataProperties = [
		[`data-anno-render`, anno.render],
		...(anno.attributes?.map((attr) => [`data-anno-${attr.name}`, JSON.stringify(attr.value)]) ?? []),
	];

	return {
		start: { line: lineNumber, character: anno.range.start },
		end: { line: lineNumber, character: anno.range.end },
		properties: Object.fromEntries(dataProperties),
	};
};

// TODO: line, block은 나중에 따로 추가.
export function remarkAnnotationToShikiDecoration(annotationConfig: AnnotationConfig) {
	return (tree: Root) => {
		visit(tree, "code", (node: Code) => {
			const rawCodeWithAnnotation = node.value;
			const lang = node.lang ?? "text";
			const meta = parseFenceMeta(node.meta ?? "");

			const lineCode: string[] = [];

			const annotationList = parseCodeToAnnotationLines(rawCodeWithAnnotation, lang, annotationConfig).flatMap(
				(line) => {
					lineCode.push(line.value.length === 0 ? "" : line.value);

					return line.annotations.flatMap((anno) => {
						if (isDecAnnotation(anno)) {
							return buildDecDecoration(line.lineNumber, anno);
						}
						if (isMarkAnnotation(anno)) {
							return buildMarkDecoration(line.lineNumber, anno);
						}

						return [];
					});
				},
			);

			node.value = lineCode.join("\n");

			if (!node.data) {
				node.data = {};
			}

			node.data.hProperties = {
				...node.data.hProperties,
				"data-decorations": JSON.stringify(annotationList),
				"data-lang": lang,
				"data-meta": JSON.stringify(meta),
			};
		});
	};
}
