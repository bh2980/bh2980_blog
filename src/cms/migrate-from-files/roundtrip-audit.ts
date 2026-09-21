import { analyze, type CmsMdxAnalysis, serialize, toDocument } from "@/cms/mdx";
import type { CmsNode } from "@/cms/mdx/types";

export interface SurfaceSample {
	line: number;
	original: string;
	roundTripped: string;
}

export interface RoundTripSample {
	path: string;
	slug: string;
	kind: "post" | "memo";
	status: "draft" | "published";
	analyzeErrors: string[];
	reparseErrors: string[];
	/** canonical 문서(analyze→toDocument)가 왕복 후에도 완전히 같은가. */
	structuralEqual: boolean;
	firstDifference: string | null;
	surfaceChanged: boolean;
	surfaceChangedLineCount: number;
	surfaceSamples: SurfaceSample[];
	/** 표기 차이의 범주(구조는 동일). 보고서에서 정규화/손실 구분에 쓴다. */
	normalizationReasons: string[];
	markCount: number;
	codeFenceCount: number;
	hash: string;
}

export interface RoundTripAudit {
	generatedAt: string;
	fileCount: number;
	structuralMismatches: number;
	analyzeErrors: number;
	reparseErrors: number;
	samples: RoundTripSample[];
	classification: {
		/** 전환을 막는 항목. 비어 있어야 한다. */
		blocking: string[];
		/** 의미가 아니라 표기만 달라진 항목. */
		normalization: string[];
		/** 범주에 안 잡힌 표기 차이. 비어 있어야 수동 검토 없이 통과할 수 있다. */
		unclassified: string[];
	};
}

/** 두 canonical 문서의 첫 차이 경로를 찾는다. */
export function firstDifference(left: unknown, right: unknown, at = "$"): string | null {
	if (left === right) return null;
	if (typeof left !== typeof right) return `${at}: type ${typeof left} vs ${typeof right}`;
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return `${at}: length ${left.length} vs ${right.length}`;
		for (let index = 0; index < left.length; index += 1) {
			const diff = firstDifference(left[index], right[index], `${at}[${index}]`);
			if (diff) return diff;
		}
		return null;
	}
	if (left && right && typeof left === "object") {
		const leftKeys = Object.keys(left as Record<string, unknown>).sort();
		const rightKeys = Object.keys(right as Record<string, unknown>).sort();
		if (leftKeys.join(",") !== rightKeys.join(",")) {
			return `${at}: keys ${leftKeys.join("|")} vs ${rightKeys.join("|")}`;
		}
		for (const key of leftKeys) {
			const diff = firstDifference(
				(left as Record<string, unknown>)[key],
				(right as Record<string, unknown>)[key],
				`${at}.${key}`,
			);
			if (diff) return diff;
		}
		return null;
	}
	return `${at}: ${JSON.stringify(left)?.slice(0, 120)} vs ${JSON.stringify(right)?.slice(0, 120)}`;
}

const countNodes = (node: CmsNode, type: string): number => {
	let total = node.type === type ? 1 : 0;
	for (const child of node.content ?? []) total += countNodes(child, type);
	return total;
};

const MARK_TAG_PATTERN = /<(strong|em|del|u|sup|sub|Tooltip)[\s>]/;
const MARK_SYNTAX_PATTERN = /\*\*|\*|~~|__/;
const ESCAPE_PATTERN = /\\[*_`[\]{}<>#-]|\\\\|\\[A-Za-z0-9.]/;
const LIST_MARKER_PATTERN = /^\s*(?:[-*+]\s|\d+\.\s)/;
const LINE_MARKER_PATTERN = /^\s*(?:[-*+]\s|\d+\.\s|>|#{1,6}\s|```)/;
const TABLE_ALIGNMENT_PATTERN = /^\|?[\s:|-]+\|?$/;

/** 표기 차이 한 줄을 정규화 범주로 분류한다. counterpart는 대응하는 반대편 줄(있으면). */
export function classifySurfaceLine(line: string, counterpart = ""): string {
	const trimmed = line.trim();
	if (trimmed.length === 0) return "blank-line";
	if (TABLE_ALIGNMENT_PATTERN.test(trimmed) && trimmed.includes("-")) return "table-alignment";
	if (
		trimmed.startsWith("|") &&
		counterpart.trim().startsWith("|") &&
		trimmed.replace(/\s*\|\s*/g, "|") === counterpart.trim().replace(/\s*\|\s*/g, "|")
	) {
		return "table-cell-padding";
	}
	if (/^```/.test(trimmed)) return "code-fence-marker-or-indent";
	if (line.includes("<IdeographicSpace />") || line.includes("&#x20;")) return "leading-space-encoding";
	if (MARK_TAG_PATTERN.test(line) || (MARK_TAG_PATTERN.test(counterpart) && MARK_SYNTAX_PATTERN.test(line))) {
		return "mark-to-html-tag";
	}
	if (LINE_MARKER_PATTERN.test(line)) return "list-marker-or-indent";
	if (ESCAPE_PATTERN.test(line)) return "escape-normalization";
	const normalizedLine = line.replace(/\s+/g, " ").trim();
	const normalizedCounterpart = counterpart.replace(/\s+/g, " ").trim();
	if (normalizedLine.length > 0 && normalizedLine === normalizedCounterpart) return "whitespace-or-wrapping";
	if (normalizedLine.length > 0 && normalizedCounterpart.length > 0 && normalizedCounterpart.includes(normalizedLine)) {
		return "whitespace-or-wrapping";
	}
	return "text-or-structure";
}

const lineMultiset = (lines: readonly string[]): Map<string, number> => {
	const counts = new Map<string, number>();
	for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
	return counts;
};

const multisetDifference = (left: readonly string[], right: readonly string[]) => {
	const leftCounts = lineMultiset(left);
	const rightCounts = lineMultiset(right);
	const added: string[] = [];
	const removed: string[] = [];
	for (const [line, count] of rightCounts) {
		const extra = count - (leftCounts.get(line) ?? 0);
		for (let index = 0; index < extra; index += 1) added.push(line);
	}
	for (const [line, count] of leftCounts) {
		const extra = count - (rightCounts.get(line) ?? 0);
		for (let index = 0; index < extra; index += 1) removed.push(line);
	}
	added.sort();
	removed.sort();
	return { added, removed };
};

const normalizeTableRow = (line: string) => line.replace(/\s*\|\s*/g, "|").trim();
const normalizeMarks = (line: string) =>
	line
		.replace(/<\/?(strong|em|del|u|sup|sub)>/g, "")
		.replace(/<\/?Tooltip[^>]*>/g, "")
		.replace(/\*\*|__|~~/g, "")
		.replace(/(?<!\*)\*(?!\*)/g, "")
		.trim();
const normalizeSpaces = (line: string) => line.replace(/\s+/g, " ").trim();

export interface OppositeSets {
	table: Set<string>;
	marks: Set<string>;
	spaces: Set<string>;
	entities: Set<string>;
	backslashes: Set<string>;
}

const normalizeEntities = (line: string) =>
	line
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
		.trim();

const normalizeBackslashes = (line: string) => line.replace(/\\/g, "");

/** 한 줄을 반대편 정규화 집합과 대조해 표기 차이 범주로 분류한다(짝 어긋남에 영향받지 않는다). */
export function classifyAgainst(line: string, opposite: OppositeSets): string {
	const trimmed = line.trim();
	if (trimmed.length === 0) return "blank-line";
	if (TABLE_ALIGNMENT_PATTERN.test(trimmed) && trimmed.includes("-")) return "table-alignment";
	if (/^```/.test(trimmed)) return "code-fence-marker-or-indent";
	if (line.includes("<IdeographicSpace />") || line.includes("&#x20;")) return "leading-space-encoding";
	if (opposite.table.has(normalizeTableRow(line))) return "table-cell-padding";
	if (opposite.marks.has(normalizeMarks(line))) return "mark-to-html-tag";
	if (/&#x?[0-9a-fA-F]+;/.test(line) && opposite.entities.has(normalizeMarks(normalizeEntities(line)))) {
		return "entity-encoding";
	}
	if (opposite.spaces.has(normalizeSpaces(line))) return "whitespace-or-wrapping";
	if (opposite.entities.has(normalizeEntities(line))) return "entity-encoding";
	if (opposite.backslashes.has(normalizeBackslashes(line))) return "escape-normalization";
	if (LINE_MARKER_PATTERN.test(line)) return "list-marker-or-indent";
	if (ESCAPE_PATTERN.test(line)) return "escape-normalization";
	return "text-or-structure";
}

/**
 * 표기 차이를 multiset 기준으로 비교한다.
 * 줄 단위 index 비교는 loose list처럼 빈 줄이 삽입될 때 뒤 줄이 전부 밀려 가짜 차이를 만든다.
 * 들여쓰기만 다른 줄은 trim 기준 비교로 분리해 `indent-or-wrapping`으로 묶는다.
 */
const surfaceComparison = (original: string, roundTripped: string) => {
	const originalLines = original.split("\n").map((line) => line.trimEnd());
	const roundTrippedLines = roundTripped.split("\n").map((line) => line.trimEnd());

	const rawDiff = multisetDifference(originalLines, roundTrippedLines);
	const rawChanged = rawDiff.added.length + rawDiff.removed.length;
	const trimmed = multisetDifference(
		originalLines.map((line) => line.trim()),
		roundTrippedLines.map((line) => line.trim()),
	);
	const indentOnly = Math.max(0, rawChanged - (trimmed.added.length + trimmed.removed.length));

	const reasons = new Map<string, number>();
	const bump = (reason: string, amount = 1) => reasons.set(reason, (reasons.get(reason) ?? 0) + amount);
	if (indentOnly > 0) bump("indent-or-wrapping", indentOnly);

	const pairs = Math.max(trimmed.added.length, trimmed.removed.length);
	const oppositeSets: OppositeSets = {
		table: new Set(trimmed.removed.map(normalizeTableRow)),
		marks: new Set(trimmed.removed.map(normalizeMarks)),
		spaces: new Set(trimmed.removed.map(normalizeSpaces)),
		entities: new Set(trimmed.removed.map((line) => normalizeEntities(normalizeMarks(line)))),
		backslashes: new Set(trimmed.removed.map(normalizeBackslashes)),
	};
	const reverseSets: OppositeSets = {
		table: new Set(trimmed.added.map(normalizeTableRow)),
		marks: new Set(trimmed.added.map(normalizeMarks)),
		spaces: new Set(trimmed.added.map(normalizeSpaces)),
		entities: new Set(trimmed.added.map((line) => normalizeEntities(normalizeMarks(line)))),
		backslashes: new Set(trimmed.added.map(normalizeBackslashes)),
	};
	for (const line of trimmed.added) bump(classifyAgainst(line, oppositeSets));
	for (const line of trimmed.removed) bump(classifyAgainst(line, reverseSets));

	const samples: SurfaceSample[] = [];
	for (let index = 0; index < Math.min(3, pairs); index += 1) {
		samples.push({
			line: index + 1,
			original: (trimmed.removed[index] ?? "").slice(0, 200),
			roundTripped: (trimmed.added[index] ?? "").slice(0, 200),
		});
	}

	return {
		changed: rawChanged,
		samples,
		surfaceChanged: original !== roundTripped,
		reasons: [...reasons.entries()]
			.sort((left, right) => right[1] - left[1])
			.map(([reason, count]) => `${reason}(${count})`),
	};
};

const hashOf = (value: string): string => {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}
	return (hash >>> 0).toString(16);
};

export interface AuditedRoundTrip {
	analysis: CmsMdxAnalysis;
	document: CmsNode;
	roundTrippedSource: string;
	sample: RoundTripSample;
}

/** 한 파일에 대해 analyze→toDocument→serialize→analyze→toDocument를 수행하고 구조 동등성을 판정한다. */
export function auditRoundTrip(
	source: string,
	meta: { path: string; slug: string; kind: "post" | "memo"; status: "draft" | "published" },
): AuditedRoundTrip {
	const analysis = analyze(source, meta.path);
	const analyzeErrors = analysis.errors.map(
		(error) => `${error.position.line}:${error.position.column} ${error.message}`,
	);
	const document = analyzeErrors.length === 0 ? toDocument(analysis) : ({ type: "doc" } as CmsNode);
	const roundTrippedSource = analyzeErrors.length === 0 ? serialize(document) : "";

	const reanalysis = analyzeErrors.length === 0 ? analyze(roundTrippedSource, meta.path) : null;
	const reparseErrors = (reanalysis?.errors ?? []).map(
		(error) => `${error.position.line}:${error.position.column} ${error.message}`,
	);
	const roundTrippedDocument = reanalysis && reparseErrors.length === 0 ? toDocument(reanalysis) : null;

	const difference =
		analyzeErrors.length === 0 && reparseErrors.length === 0 ? firstDifference(document, roundTrippedDocument) : null;
	const surface =
		analyzeErrors.length === 0 && reparseErrors.length === 0
			? surfaceComparison(source, roundTrippedSource)
			: { changed: 0, samples: [], surfaceChanged: false, reasons: [] };

	return {
		analysis,
		document,
		roundTrippedSource,
		sample: {
			...meta,
			analyzeErrors,
			reparseErrors,
			structuralEqual: analyzeErrors.length === 0 && reparseErrors.length === 0 && difference === null,
			firstDifference: difference,
			surfaceChanged: surface.surfaceChanged,
			surfaceChangedLineCount: surface.changed,
			surfaceSamples: surface.samples,
			normalizationReasons: surface.reasons,
			markCount: analyzeErrors.length === 0 ? countNodes(document, "text") : 0,
			codeFenceCount: analyzeErrors.length === 0 ? countNodes(document, "codeBlock") : 0,
			hash: hashOf(roundTrippedSource),
		},
	};
}

export const summarizeAudit = (samples: RoundTripSample[], generatedAt: string): RoundTripAudit => ({
	generatedAt,
	fileCount: samples.length,
	structuralMismatches: samples.filter((sample) => !sample.structuralEqual).length,
	analyzeErrors: samples.filter((sample) => sample.analyzeErrors.length > 0).length,
	reparseErrors: samples.filter((sample) => sample.reparseErrors.length > 0).length,
	samples,
	classification: {
		blocking: samples
			.filter((sample) => !sample.structuralEqual || sample.analyzeErrors.length > 0 || sample.reparseErrors.length > 0)
			.map(
				(sample) =>
					`${sample.path}: ${sample.firstDifference ?? sample.analyzeErrors[0] ?? sample.reparseErrors[0] ?? "unknown"}`,
			),
		normalization: samples
			.filter((sample) => sample.structuralEqual && sample.surfaceChanged)
			.map(
				(sample) =>
					`${sample.path}: 표기 차이 ${sample.surfaceChangedLineCount}줄 (${sample.normalizationReasons.join(", ") || "기타"}) — 구조 동일`,
			),
		/** 위 범주에 안 잡히는 표기 차이. 비어 있지 않으면 수동 검토가 필요하다. */
		unclassified: samples.flatMap((sample) => {
			const reasons = sample.normalizationReasons.filter((reason) => reason.startsWith("text-or-structure"));
			return reasons.length > 0 ? [`${sample.path}: ${reasons.join(", ")}`] : [];
		}),
	},
});
