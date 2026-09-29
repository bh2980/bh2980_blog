import { analyze, type CmsJsonValue, type CmsNode, serialize, toDocument } from "@/cms/mdx";

/**
 * 번역 단위(v3 번역 화면, `docs/cms/v3/translation.md` §2).
 *
 * 원문 문서를 앞에서부터 번역 단위로 나누고, 단위마다 번역 결과를 끼워 번역본 문서를 다시 만든다.
 * 본문 MDX에는 블록 ID를 넣지 않는다. 대신 번역할 때 기준으로 삼은 원문 조각을 저장해 두고,
 * 원문이 바뀌면 조각끼리 비교해 짝을 다시 맞춘다(`alignUnits`). 서버·브라우저가 같이 쓴다.
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

/** MDX 조각을 블록 노드로 읽는다. 조각이 여러 블록이면 모두 돌려준다. */
export const parseFragment = (mdx: string): CmsNode[] => toDocument(analyze(mdx)).content ?? [];

export const parseHeader = (value: string): HeaderValue | null => {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (parsed && typeof parsed === "object") {
			const record = parsed as Record<string, unknown>;
			if (typeof record.title === "string") return { title: record.title };
			if (Array.isArray(record.labels) && record.labels.every((label) => typeof label === "string")) {
				return { labels: record.labels as string[] };
			}
		}
	} catch {
		// 잘못된 값은 번역하지 않은 것으로 본다.
	}
	return null;
};

/** JSX 상자는 속성을 `attrs.이름`과 `attrs.attributes` 두 곳에 둔다. 둘 다 바꾼다. */
const withJsxAttr = (node: CmsNode, name: string, value: string): CmsNode => {
	const attributes: CmsJsonValue[] = Array.isArray(node.attrs?.attributes) ? node.attrs.attributes : [];
	const nameOf = (attribute: CmsJsonValue) =>
		attribute && typeof attribute === "object" && !Array.isArray(attribute) ? attribute.name : undefined;
	const rest = attributes.filter((attribute) => nameOf(attribute) !== name);
	const { [name]: _removed, ...attrs } = node.attrs ?? {};
	if (!value) return { ...node, attrs: { ...attrs, attributes: rest } };
	const index = attributes.findIndex((attribute) => nameOf(attribute) === name);
	const nextAttributes = [...rest];
	nextAttributes.splice(index === -1 ? rest.length : index, 0, { name, value });
	return { ...node, attrs: { ...attrs, [name]: value, attributes: nextAttributes } };
};

const applyHeader = (node: CmsNode, header: HeaderValue | null): CmsNode => {
	if (node.type === "Tabs") {
		const labels = header && "labels" in header ? header.labels : [];
		let index = 0;
		return {
			...node,
			content: (node.content ?? []).map((child) =>
				child.type === "Tab" ? withJsxAttr(child, "label", labels[index++] ?? "") : child,
			),
		};
	}
	return withJsxAttr(node, "title", header && "title" in header ? header.title : "");
};

/**
 * 원문 뼈대에 단위별 번역을 끼워 번역본 문서를 만든다. `targets`는 `flattenUnits(sourceDoc)`와 같은 순서다.
 * 번역하지 않은 블록(`null`)은 빼고, 번역하지 않은 머리 줄은 비운다(미리보기용 — 발행은 미번역이 없어야 한다).
 */
export function buildTranslatedDoc(sourceDoc: CmsNode, targets: readonly (string | null)[]): CmsNode {
	return buildWithOwners(sourceDoc, targets).doc;
}

/**
 * `buildTranslatedDoc`과 같고, 만든 노드마다 어느 단위에서 왔는지(`owners`)도 돌려준다.
 * 블록은 그 노드, 머리 줄은 상자 노드가 단위를 가리킨다. 번역 미리보기가 누른 블록을 단위로 찾을 때 쓴다.
 */
export function buildWithOwners(
	sourceDoc: CmsNode,
	targets: readonly (string | null)[],
): { doc: CmsNode; owners: Map<CmsNode, number> } {
	const owners = new Map<CmsNode, number>();
	let cursor = 0;
	const build = (nodes: readonly CmsNode[]): CmsNode[] =>
		nodes.flatMap((node) => {
			if (EXPANDED.has(node.type)) {
				const headerIndex = headerValue(node) ? cursor++ : undefined;
				const header = headerIndex === undefined ? undefined : (targets[headerIndex] ?? null);
				const content = build(node.content ?? []);
				const shell = header === undefined ? node : applyHeader(node, header === null ? null : parseHeader(header));
				// 탭 이름은 머리 줄에서 먼저 바꿨다. 안쪽 탭 노드는 속성을 유지하고 내용만 새로 만든다.
				const built =
					node.type === "Tabs"
						? { ...shell, content: rebuildTabs(shell.content ?? [], content) }
						: { ...shell, content };
				if (headerIndex !== undefined) owners.set(built, headerIndex);
				return [built];
			}
			const index = cursor++;
			const target = targets[index] ?? null;
			const produced = target === null ? [] : parseFragment(target);
			for (const child of produced) owners.set(child, index);
			return produced;
		});
	/** `Tabs`의 자식은 이미 `build`로 새로 만들었다(탭 순서 그대로). 머리 줄에서 바꾼 이름을 입힌다. */
	const rebuildTabs = (labelled: readonly CmsNode[], built: readonly CmsNode[]) =>
		built.map((child, index) =>
			child.type === "Tab" && labelled[index]?.type === "Tab" ? { ...child, attrs: labelled[index]?.attrs } : child,
		);
	return { doc: { ...sourceDoc, content: build(sourceDoc.content ?? []) }, owners };
}

/** 번역 단위로 펼치는 상자인가. 미리보기가 에디터 문서와 짝을 맞출 때 같은 규칙을 쓴다. */
export const isExpandedContainer = (type: string) => EXPANDED.has(type);

/** 저장된 번역 단위(`entry_bodies.translation.units`). */
export interface StoredUnit {
	readonly key: string;
	/** 번역할 때 기준으로 삼은 원문 조각. */
	readonly source: string;
	/** 번역 결과. `null`이면 미번역이다. */
	readonly target: string | null;
}

export type UnitStatus = "translated" | "changed" | "untranslated";

export interface AlignedUnit {
	readonly unit: TranslationUnit;
	readonly status: UnitStatus;
	/** 저장된 기준 원문 조각. 원문 변경됨이면 바뀌기 전 원문이다. */
	readonly baseSource: string;
	readonly target: string | null;
}

/** 두 목록의 최장 공통 부분열(열쇠와 원문 조각이 모두 같은 쌍). [current 위치, stored 위치] 목록을 돌려준다. */
const commonPairs = (current: readonly TranslationUnit[], stored: readonly StoredUnit[]): [number, number][] => {
	const same = (i: number, j: number) => current[i]?.key === stored[j]?.key && current[i]?.source === stored[j]?.source;
	const rows = current.length + 1;
	const cols = stored.length + 1;
	const table = new Array<number>(rows * cols).fill(0);
	for (let i = current.length - 1; i >= 0; i -= 1) {
		for (let j = stored.length - 1; j >= 0; j -= 1) {
			table[i * cols + j] = same(i, j)
				? (table[(i + 1) * cols + j + 1] ?? 0) + 1
				: Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
		}
	}
	const pairs: [number, number][] = [];
	let i = 0;
	let j = 0;
	while (i < current.length && j < stored.length) {
		if (same(i, j)) {
			pairs.push([i, j]);
			i += 1;
			j += 1;
		} else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) i += 1;
		else j += 1;
	}
	return pairs;
};

/**
 * 지금 원문 단위와 저장된 번역 단위를 맞춘다(§3.2).
 * 1. 열쇠·원문 조각이 같은 쌍을 순서대로 최대한 맞춘다.
 * 2. 그 사이에 남은 쌍 중 열쇠가 같은 것은 `원문 변경됨`(번역 유지).
 * 3. 원문에만 있는 단위는 미번역, 번역에만 남은 단위는 버린다(원문에서 지운 블록).
 * 번역할 것이 없는 단위(`auto`)는 늘 원문 그대로 번역됨이다.
 */
export function alignUnits(current: readonly TranslationUnit[], stored: readonly StoredUnit[]): AlignedUnit[] {
	const matched = new Map<number, StoredUnit>();
	const changed = new Map<number, StoredUnit>();
	const anchors = [...commonPairs(current, stored), [current.length, stored.length] as [number, number]];
	let prevCurrent = 0;
	let prevStored = 0;
	for (const [ci, si] of anchors) {
		// 앵커 사이 구간: 열쇠가 같은 것끼리 순서대로 짝짓는다.
		let s = prevStored;
		for (let c = prevCurrent; c < ci; c += 1) {
			const key = current[c]?.key;
			let found = -1;
			for (let k = s; k < si; k += 1) {
				if (stored[k]?.key === key) {
					found = k;
					break;
				}
			}
			if (found !== -1) {
				const pair = stored[found];
				if (pair) changed.set(c, pair);
				s = found + 1;
			}
		}
		const anchor = stored[si];
		if (ci < current.length && anchor) matched.set(ci, anchor);
		prevCurrent = ci + 1;
		prevStored = si + 1;
	}

	return current.map((unit, index): AlignedUnit => {
		if (unit.auto) return { unit, status: "translated", baseSource: unit.source, target: unit.source };
		const same = matched.get(index);
		if (same) {
			return {
				unit,
				status: same.target === null ? "untranslated" : "translated",
				baseSource: unit.source,
				target: same.target,
			};
		}
		const before = changed.get(index);
		if (before && before.target !== null) {
			return { unit, status: "changed", baseSource: before.source, target: before.target };
		}
		return { unit, status: "untranslated", baseSource: unit.source, target: null };
	});
}

/** 저장할 단위 목록. 원문 변경됨은 바뀌기 전 원문을 기준으로 남겨 표시를 유지한다. */
export const toStoredUnits = (aligned: readonly AlignedUnit[]): StoredUnit[] =>
	aligned.map((item) => ({ key: item.unit.key, source: item.baseSource, target: item.target }));

/** 번역을 고치면 지금 원문을 기준으로 삼는다(원문 변경됨 표시가 사라진다). `null`이면 미번역으로 돌린다. */
export const withTarget = (item: AlignedUnit, target: string | null): AlignedUnit => ({
	unit: item.unit,
	status: target === null ? "untranslated" : "translated",
	baseSource: item.unit.source,
	target,
});

/** 원문 변경을 번역에 반영할 필요가 없을 때(오타 수정 등) 표시만 지운다. */
export const ignoreChange = (item: AlignedUnit): AlignedUnit =>
	item.status === "changed" ? { ...item, status: "translated", baseSource: item.unit.source } : item;

/** 원문 MDX와 저장된 번역 단위로 번역본 MDX를 만든다. 원문을 해석할 수 없으면 `null`. */
export function translatedMdx(sourceMdx: string, stored: readonly StoredUnit[]): string | null {
	const analysis = analyze(sourceMdx);
	if (analysis.errors.length > 0) return null;
	const doc = toDocument(analysis);
	const aligned = alignUnits(flattenUnits(doc), stored);
	return serialize(
		buildTranslatedDoc(
			doc,
			aligned.map((item) => item.target),
		),
	);
}

/**
 * 새 번역본의 본문과 번역 상태(v3 결정 7). 모든 단위가 미번역이고 번역할 것이 없는 블록만 원문 그대로다.
 * 원문을 해석할 수 없으면 빈 본문·빈 목록으로 시작한다(원문을 고친 뒤 번역 화면이 다시 맞춘다).
 */
export function initialTranslation(sourceMdx: string): { mdx: string; units: StoredUnit[] } {
	const analysis = analyze(sourceMdx);
	if (analysis.errors.length > 0) return { mdx: "", units: [] };
	const doc = toDocument(analysis);
	const aligned = alignUnits(flattenUnits(doc), []);
	return {
		mdx: serialize(
			buildTranslatedDoc(
				doc,
				aligned.map((item) => item.target),
			),
		),
		units: toStoredUnits(aligned),
	};
}

/**
 * 발행 전 검사(v3 결정 11): 원문 최신 초안과 맞춘 뒤 미번역 수와, 저장된 번역본 본문이 지금 원문 뼈대로 만든 값과
 * 다른지(원문에 블록이 더해지거나 빠졌는데 번역 화면에서 다시 저장하지 않았는지)를 본다.
 */
export function checkTranslation(
	sourceMdx: string,
	translationMdx: string,
	state: { readonly units: readonly StoredUnit[] } | null | undefined,
): { untranslated: number; outdated: boolean } {
	const analysis = analyze(sourceMdx);
	if (analysis.errors.length > 0) return { untranslated: 0, outdated: true };
	const doc = toDocument(analysis);
	const aligned = alignUnits(flattenUnits(doc), state?.units ?? []);
	const untranslated = aligned.filter((item) => item.status === "untranslated").length;
	const rebuilt = serialize(
		buildTranslatedDoc(
			doc,
			aligned.map((item) => item.target),
		),
	);
	// 끝 줄바꿈 차이는 같은 본문으로 본다(저장 경로마다 마지막 개행이 다를 수 있다).
	return { untranslated, outdated: untranslated === 0 && rebuilt.trimEnd() !== translationMdx.trimEnd() };
}
