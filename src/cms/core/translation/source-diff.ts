import { analyze, type CmsNode, serialize, toDocument } from "@/cms/mdx";

/**
 * 원문 두 버전의 블록 비교(v3 번역 화면, `docs/cms/v3/translation.md`).
 *
 * 번역자가 마지막으로 확인한 원문과 지금 원문을 블록 단위로 나눠 바뀐·더해진·빠진 블록을 찾는다.
 * 상자(콜아웃·접기·탭·단 나누기·정렬)는 펼쳐서 제목·탭 이름과 안쪽 블록을 각각 비교한다. 서버·브라우저가 같이 쓴다.
 */

/** 펼치는 상자: 상자 자체는 뼈대이고 안쪽 블록이 각각 단위다. */
const EXPANDED = new Set(["Callout", "Collapsible", "Tabs", "Tab", "Columns", "Column", "TextAlign"]);

/** 머리 줄로 번역할 속성. 탭 이름은 `Tabs` 머리 줄 하나에 모은다. */
const HEADER_TITLE = new Set(["Callout", "Collapsible"]);

/** 번역할 글자가 없어 원문을 그대로 쓰는 블록. */
const STRUCTURAL = new Set(["horizontalRule", "html", "mdxEsm", "mdxExpression"]);

/** 글자가 없어도 사람이 확인해야 하는 블록(주석·라벨이 들어갈 수 있다). */
const ALWAYS_MANUAL = new Set(["codeBlock", "math", "Chart", "Mermaid", "CodeBlock", "Math"]);

export type UnitKind = "block" | "header";

export interface TranslationUnit {
	/** 맞추기 열쇠: 조상 상자 종류 + 단위 종류 + 노드 종류. 같은 열쇠끼리만 짝이 된다. */
	readonly key: string;
	readonly kind: UnitKind;
	/** 노드 종류(`paragraph`, `codeBlock`, `Callout` …). */
	readonly type: string;
	/** 블록은 그 노드, 머리 줄은 상자 노드. */
	readonly node: CmsNode;
	/** 원문 조각. 블록은 MDX, 머리 줄은 번역할 속성의 JSON이다. */
	readonly source: string;
	/** 번역할 것이 없어 원문을 그대로 쓴다(구분선, 빈 문단, 설명 없는 이미지 등). */
	readonly auto: boolean;
}

/** 머리 줄의 번역 값. 콜아웃·접기는 제목, 탭 묶음은 탭 이름들이다. */
export type HeaderValue = { title: string } | { labels: string[] };

const textOf = (node: CmsNode): string =>
	(node.text ?? "") + (node.content ?? []).map(textOf).join("") + attrText(node);

const attrText = (node: CmsNode): string => {
	if (node.type !== "image") return "";
	return [node.attrs?.alt, node.attrs?.title].filter((value) => typeof value === "string").join("");
};

const isAuto = (node: CmsNode): boolean => {
	if (STRUCTURAL.has(node.type)) return true;
	if (ALWAYS_MANUAL.has(node.type)) {
		const value = node.attrs?.value;
		return typeof value === "string" ? value.trim().length === 0 : false;
	}
	return textOf(node).trim().length === 0;
};

const blockSource = (node: CmsNode) => serialize({ type: "doc", content: [node] }).trimEnd();

const stringAttr = (node: CmsNode, name: string) => {
	const value = node.attrs?.[name];
	return typeof value === "string" ? value : "";
};

const headerValue = (node: CmsNode): HeaderValue | null => {
	if (HEADER_TITLE.has(node.type)) {
		const title = stringAttr(node, "title");
		return title.trim() ? { title } : null;
	}
	if (node.type === "Tabs") {
		const labels = (node.content ?? []).filter((child) => child.type === "Tab").map((tab) => stringAttr(tab, "label"));
		return labels.some((label) => label.trim()) ? { labels } : null;
	}
	return null;
};

/** 원문 문서를 번역 단위로 나눈다(문서 순서). */
export function flattenUnits(doc: CmsNode): TranslationUnit[] {
	const units: TranslationUnit[] = [];
	const walk = (nodes: readonly CmsNode[], scope: string) => {
		for (const node of nodes) {
			if (EXPANDED.has(node.type)) {
				const header = headerValue(node);
				if (header) {
					units.push({
						key: `${scope}|header|${node.type}`,
						kind: "header",
						type: node.type,
						node,
						source: JSON.stringify(header),
						auto: false,
					});
				}
				walk(node.content ?? [], `${scope}/${node.type}`);
				continue;
			}
			units.push({
				key: `${scope}|block|${node.type}`,
				kind: "block",
				type: node.type,
				node,
				source: blockSource(node),
				auto: isAuto(node),
			});
		}
	};
	walk(doc.content ?? [], "");
	return units;
}

/** 원문 한 버전에서 바뀐 블록. 문서 순서대로다. */
export type SourceChange =
	| { readonly kind: "changed"; readonly before: TranslationUnit; readonly after: TranslationUnit }
	| { readonly kind: "added"; readonly after: TranslationUnit }
	| { readonly kind: "removed"; readonly before: TranslationUnit };

/** 두 목록의 최장 공통 부분열(열쇠와 원문 조각이 모두 같은 쌍). [before 위치, after 위치] 목록이다. */
const commonPairs = (before: readonly TranslationUnit[], after: readonly TranslationUnit[]): [number, number][] => {
	const same = (i: number, j: number) => before[i]?.key === after[j]?.key && before[i]?.source === after[j]?.source;
	const cols = after.length + 1;
	const table = new Array<number>((before.length + 1) * cols).fill(0);
	for (let i = before.length - 1; i >= 0; i -= 1) {
		for (let j = after.length - 1; j >= 0; j -= 1) {
			table[i * cols + j] = same(i, j)
				? (table[(i + 1) * cols + j + 1] ?? 0) + 1
				: Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
		}
	}
	const pairs: [number, number][] = [];
	let i = 0;
	let j = 0;
	while (i < before.length && j < after.length) {
		if (same(i, j)) {
			pairs.push([i, j]);
			i += 1;
			j += 1;
		} else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) i += 1;
		else j += 1;
	}
	return pairs;
};

const unitsOf = (mdx: string): TranslationUnit[] | null => {
	const analysis = analyze(mdx);
	return analysis.errors.length > 0 ? null : flattenUnits(toDocument(analysis));
};

/**
 * 원문 두 버전을 블록 단위로 비교한다. 같은 블록은 빼고, 같은 자리(열쇠가 같은 쌍)에서 내용만 바뀐 블록은
 * `changed`, 새 블록은 `added`, 없어진 블록은 `removed`다. 어느 쪽이든 해석할 수 없으면 `null`.
 */
export function diffSources(beforeMdx: string, afterMdx: string): SourceChange[] | null {
	const before = unitsOf(beforeMdx);
	const after = unitsOf(afterMdx);
	if (!before || !after) return null;
	const changes: SourceChange[] = [];
	const anchors = [...commonPairs(before, after), [before.length, after.length] as [number, number]];
	let prevBefore = 0;
	let prevAfter = 0;
	for (const [bi, ai] of anchors) {
		// 앵커 사이 구간: 열쇠가 같은 것끼리 순서대로 짝지으면 바뀐 블록, 남으면 빠지거나 더해진 블록이다.
		let b = prevBefore;
		for (let a = prevAfter; a < ai; a += 1) {
			const next = after[a];
			if (!next) continue;
			let found = -1;
			for (let k = b; k < bi; k += 1) {
				if (before[k]?.key === next.key) {
					found = k;
					break;
				}
			}
			if (found === -1) {
				changes.push({ kind: "added", after: next });
				continue;
			}
			for (let k = b; k < found; k += 1) {
				const gone = before[k];
				if (gone) changes.push({ kind: "removed", before: gone });
			}
			const old = before[found];
			if (old) changes.push({ kind: "changed", before: old, after: next });
			b = found + 1;
		}
		for (let k = b; k < bi; k += 1) {
			const gone = before[k];
			if (gone) changes.push({ kind: "removed", before: gone });
		}
		prevBefore = bi + 1;
		prevAfter = ai + 1;
	}
	return changes;
}
