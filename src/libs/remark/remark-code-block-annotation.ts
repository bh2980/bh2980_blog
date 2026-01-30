import type { Code, Root, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxExpressionAttribute } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { type LineAnnotation, parseCodeToAnnotationLines, parseFenceMeta } from "@/keystatic/libs/parse-annotations";
import type { AnnotationConfig } from "@/keystatic/libs/serialize-annotations";
import type { ClassLineAnnotation, RenderLineAnnotation } from "./../../keystatic/libs/parse-annotations";

export type Annotation =
	| {
			type: Exclude<RootContent["type"], "mdxJsxTextElement">;
			start: number;
			end: number;
	  }
	| {
			type: "mdxJsxTextElement";
			name: string | null;
			attributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[];
			start: number;
			end: number;
	  };

const isClassAnnotation = (anno: LineAnnotation): anno is ClassLineAnnotation =>
	(anno.tag === "dec" || anno.tag === "line") && "class" in anno;
const isRenderAnnotation = (anno: LineAnnotation): anno is RenderLineAnnotation =>
	(anno.tag === "mark" || anno.tag === "block") && "render" in anno;

export function remarkCodeBlockAnnotation(annotationConfig: AnnotationConfig) {
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
						if (isClassAnnotation(anno)) {
							return {
								start: { line: line.lineNumber, character: anno.range.start },
								end: { line: line.lineNumber, character: anno.range.end },
								properties: { class: anno.class },
							};
						}
						if (isRenderAnnotation(anno)) {
							const dataProperties = [
								[`data-anno-render`, anno.render],
								...(anno.attributes?.map((attr) => [`data-anno-${attr.name}`, JSON.stringify(attr.value)]) ?? []),
							];

							return {
								start: { line: line.lineNumber, character: anno.range.start },
								end: { line: line.lineNumber, character: anno.range.end },
								properties: Object.fromEntries(dataProperties),
							};
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
				"data-annotations": JSON.stringify(annotationList),
				"data-lang": lang,
				"data-meta": JSON.stringify(meta),
			};
		});
	};
}
