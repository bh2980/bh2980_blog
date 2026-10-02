import { analyze, toDocument } from "@/cms/mdx";
import type { CmsJsonValue, CmsNode } from "@/cms/mdx/types";

/**
 * 번역 결과의 구조 검사(v2 D2). 원문과 번역의 "글자를 뺀 뼈대"가 같은지 본다.
 *
 * - 같아야 하는 것: 블록·인라인 요소의 종류와 순서, 링크 주소, 이미지 주소, 코드·수식 내용, 코드 언어,
 *   directive·JSX 이름과 사람이 읽지 않는 속성, 인라인 코드 글자.
 * - 달라도 되는 것: 글자, 사람이 읽는 속성 값(`READABLE_ATTRS`), 문장 안에서 굵게·링크가 걸린 위치.
 */

/** 사람이 읽는 속성. 번역하면 값이 바뀐다. `defaultValue`는 탭 이름을 가리켜 함께 바뀐다. */
const READABLE_ATTRS = new Set(["title", "label", "alt", "caption", "content", "defaultValue"]);

type Skeleton = {
	type: string;
	attrs: Record<string, CmsJsonValue>;
	/** 이 노드 바로 아래 글자에 걸린 서식(종류·주소). 겹치지 않게 모아 정렬한다. */
	marks: string[];
	/** 이 노드 바로 아래 인라인 코드 글자(번역하지 않는다). */
	codes: string[];
	children: Skeleton[];
};

const withoutReadable = (attrs: Record<string, CmsJsonValue> | undefined): Record<string, CmsJsonValue> => {
	const kept: Record<string, CmsJsonValue> = {};
	for (const [key, value] of Object.entries(attrs ?? {})) {
		if (READABLE_ATTRS.has(key)) continue;
		// JSX 원래 속성 목록: 이름은 그대로, 사람이 읽는 속성의 값만 뺀다.
		kept[key] =
			key === "attributes" && Array.isArray(value)
				? value.map((item) => {
						const attribute = item as { name?: unknown; value?: CmsJsonValue };
						return typeof attribute.name === "string" && READABLE_ATTRS.has(attribute.name)
							? { name: attribute.name }
							: (item as CmsJsonValue);
					})
				: value;
	}
	return kept;
};

function skeletonOf(node: CmsNode): Skeleton {
	const marks = new Set<string>();
	const codes: string[] = [];
	const children: Skeleton[] = [];
	for (const child of node.content ?? []) {
		if (child.type !== "text") {
			children.push(skeletonOf(child));
			continue;
		}
		for (const mark of child.marks ?? []) {
			if (mark.type === "code") codes.push(child.text ?? "");
			else marks.add(JSON.stringify([mark.type, withoutReadable(mark.attrs)]));
		}
	}
	return {
		type: node.type,
		attrs: withoutReadable(node.attrs),
		marks: [...marks].sort(),
		codes: codes.sort(),
		children,
	};
}

export type StructureCheck = { ok: true } | { ok: false; reason: string };

/** 번역한 MDX가 원문 MDX와 같은 뼈대인가. MDX로 읽을 수 없으면 실패다. */
export function compareStructure(sourceMdx: string, translatedMdx: string): StructureCheck {
	const translated = analyze(translatedMdx);
	if (translated.errors.length > 0) {
		return { ok: false, reason: `MDX 오류: ${translated.errors[0]?.message ?? "읽을 수 없습니다."}` };
	}
	const source = analyze(sourceMdx);
	if (source.errors.length > 0) return { ok: false, reason: "원문을 읽을 수 없습니다." };
	const a = skeletonOf(toDocument(source));
	const b = skeletonOf(toDocument(translated));
	return JSON.stringify(a) === JSON.stringify(b)
		? { ok: true }
		: { ok: false, reason: "원문과 구조(요소·링크·코드·속성)가 달라졌습니다." };
}

/** MDX로 읽을 수 있는가(구조 검사를 끈 때도 본문에 넣으려면 읽을 수 있어야 한다). */
export function readableMdx(mdx: string): StructureCheck {
	const analysis = analyze(mdx);
	return analysis.errors.length > 0
		? { ok: false, reason: `MDX 오류: ${analysis.errors[0]?.message ?? "읽을 수 없습니다."}` }
		: { ok: true };
}
