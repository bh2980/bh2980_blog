import type { JSONContent } from "@tiptap/core";
import type { Code } from "mdast";
import {
	fromCodeFenceToCodeBlockDocument,
	parseCodeFenceMeta,
} from "@/libs/annotation/code-block/code-fence-to-document";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import type { CodeBlockDocument, InlineAnnotation } from "@/libs/annotation/code-block/types";
import type { CmsNode } from "../../mdx";
import type { CodeBlockAnnotationItem } from "../code-block/types";
import { asString } from "./shared";
import type { BlockConverter, ConverterContext } from "./types";

const extractCodeBlockValue = (node: CmsNode): string => {
	const value = asString(node.attrs?.value);
	if (value != null) return value;
	const document = node.attrs?.codeDocument;
	if (document && typeof document === "object" && !Array.isArray(document)) {
		return fromCodeBlockDocumentToCodeFence(document as unknown as CodeBlockDocument, annotationConfig).value;
	}
	return "";
};

export const codeBlockConverter: BlockConverter = {
	name: "codeBlock",
	cmsTypes: ["codeBlock"],
	tiptapTypes: ["codeBlock"],
	isMappable: () => true,

	toTiptap(node: CmsNode, _ctx?: ConverterContext) {
		const language = asString(node.attrs?.language) ?? null;
		const meta = asString(node.attrs?.meta) ?? null;
		const rawValue = extractCodeBlockValue(node);

		// 주석 구문 파싱 시도
		const codeNode: Code = {
			type: "code",
			lang: language ?? undefined,
			meta: meta ?? undefined,
			value: rawValue,
		};

		let doc: CodeBlockDocument;
		try {
			doc = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
		} catch {
			// 파싱 실패 시 원문 그대로 유지하고 주석 UI 비활성화
			return {
				type: "codeBlock",
				attrs: {
					language,
					meta,
					annotations: [],
					annotationsDisabled: true,
					raw: rawValue,
				},
				content: rawValue.length > 0 ? [{ type: "text", text: rawValue }] : [],
			};
		}

		// 지원하지 않는 주석 형태(라인 주석, 밑줄·툴팁 외 인라인 주석) 검사
		const hasLineAnnotations = doc.annotations.length > 0;
		const allInlineAnnotations = doc.lines.flatMap((line) => line.annotations);
		const hasUnsupportedInline = allInlineAnnotations.some(
			(anno) => anno.scope !== "char" || (anno.name !== "u" && anno.name !== "Tooltip"),
		);

		if (hasLineAnnotations || hasUnsupportedInline) {
			// 지원하지 않는 주석이 포함된 경우: 원문 value 그대로 두고 주석 UI 비활성화(데이터 손실 금지)
			return {
				type: "codeBlock",
				attrs: {
					language,
					meta,
					annotations: [],
					annotationsDisabled: true,
					raw: rawValue,
				},
				content: rawValue.length > 0 ? [{ type: "text", text: rawValue }] : [],
			};
		}

		if (allInlineAnnotations.length === 0) {
			// 주석이 없는 일반 코드 블록: 바이트 불변 보장
			return {
				type: "codeBlock",
				attrs: {
					language,
					meta,
					annotations: [],
					annotationsDisabled: false,
					raw: rawValue,
				},
				content: rawValue.length > 0 ? [{ type: "text", text: rawValue }] : [],
			};
		}

		// 밑줄('u') 및 툴팁('Tooltip') 주석만 있는 경우:
		// 코드 텍스트는 주석 코멘트가 제거된 실제 코드 본문
		const cleanCodeText = doc.lines.map((line) => line.value).join("\n");
		const annotations: CodeBlockAnnotationItem[] = allInlineAnnotations.map((anno, index) => {
			const isTooltip = anno.name === "Tooltip";
			const content = isTooltip
				? ((anno.attributes?.find((a) => a.name === "content")?.value as string) ?? "")
				: undefined;

			return {
				id: `anno-${index}`,
				type: isTooltip ? "tooltip" : "underline",
				from: anno.range.start,
				to: anno.range.end,
				...(content !== undefined ? { content } : {}),
			};
		});

		return {
			type: "codeBlock",
			attrs: {
				language,
				meta,
				annotations,
				annotationsDisabled: false,
				raw: rawValue,
				rawLanguage: language,
				cleanCode: cleanCodeText,
				initialAnnotationsJson: JSON.stringify(annotations),
			},
			content: cleanCodeText.length > 0 ? [{ type: "text", text: cleanCodeText }] : [],
		};
	},

	toCms(node: JSONContent, _ctx?: ConverterContext) {
		const text = (node.content ?? []).map((child) => (child?.type === "text" ? (child.text ?? "") : "")).join("");
		const language = asString(node.attrs?.language);
		const meta = asString(node.attrs?.meta);
		const raw = asString(node.attrs?.raw);
		const cleanCode = asString(node.attrs?.cleanCode);
		const annotationsDisabled = Boolean(node.attrs?.annotationsDisabled);
		const annotations = Array.isArray(node.attrs?.annotations)
			? (node.attrs.annotations as CodeBlockAnnotationItem[])
			: [];
		const initialAnnotationsJson = asString(node.attrs?.initialAnnotationsJson);

		// 1) 주석 UI 비활성화 노드: 수정되지 않았으면 raw 그대로, 수정되었으면 text
		if (annotationsDisabled) {
			const value = raw != null && text === raw ? raw : text;
			return [{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value } }];
		}

		// 2) 주석이 없는 경우
		if (annotations.length === 0) {
			// 기존에 주석이 있었는데 모두 삭제된 경우 clean text 출력
			if (cleanCode != null && cleanCode !== raw) {
				return [
					{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value: text } },
				];
			}
			// 편집되지 않은 주석 없는 코드는 raw 바이트 불변
			const value = raw != null && text === raw ? raw : text;
			return [{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value } }];
		}

		// 3) 주석이 있는 경우: 편집되지 않았다면 raw 바이트 불변
		if (
			raw != null &&
			cleanCode != null &&
			text === cleanCode &&
			initialAnnotationsJson === JSON.stringify(annotations) &&
			node.attrs?.rawLanguage === language
		) {
			return [
				{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value: raw } },
			];
		}

		// 4) 주석 또는 텍스트가 편집된 경우: document-to-code-fence로 변환
		const lines = text.split("\n");
		const lineStartOffsets: number[] = [];
		let currentOffset = 0;
		for (const line of lines) {
			lineStartOffsets.push(currentOffset);
			currentOffset += line.length + 1; // '\n'
		}

		const lineAnnos: Record<number, InlineAnnotation[]> = {};

		annotations.forEach((anno, index) => {
			if (anno.from >= anno.to) return;
			// 펜스 주석 범위는 **줄 로컬** 좌표다. 여러 줄에 걸친 기존 주석도 줄마다 나눈다.
			for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
				const line = lines[lineIndex] ?? "";
				const lineStart = lineStartOffsets[lineIndex] ?? 0;
				const from = Math.max(anno.from, lineStart) - lineStart;
				const to = Math.min(anno.to, lineStart + line.length) - lineStart;
				if (to <= from) continue;
				const isTooltip = anno.type === "tooltip";
				const inlineAnno: InlineAnnotation = {
					scope: "char",
					source: "mdx-text",
					name: isTooltip ? "Tooltip" : "u",
					render: isTooltip ? "Tooltip" : "u",
					range: { start: from, end: to },
					order: index,
					priority: isTooltip ? 0 : 4,
					attributes: isTooltip ? [{ name: "content", value: anno.content ?? "" }] : [],
				};
				lineAnnos[lineIndex] ??= [];
				lineAnnos[lineIndex].push(inlineAnno);
			}
		});

		const doc: CodeBlockDocument = {
			lang: language ?? "text",
			meta: meta ? parseCodeFenceMeta(meta) : {},
			annotations: [],
			lines: lines.map((val, idx) => ({
				value: val,
				annotations: lineAnnos[idx] ?? [],
			})),
		};

		const fence = fromCodeBlockDocumentToCodeFence(doc, annotationConfig);
		const value = fence.value;

		return [{ type: "codeBlock", attrs: { ...(language ? { language } : {}), ...(meta ? { meta } : {}), value } }];
	},
};
