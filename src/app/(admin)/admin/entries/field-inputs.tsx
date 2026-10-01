"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { BacklinkField, RelationField, ValueField } from "@/cms/schema/fields";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CmsApiError, cmsFetch, errorText } from "../admin-api";
import { type RecordCollection, useTaxonomy } from "../shared/use-taxonomy";
import type { FormValue } from "./entry-form";
import { RelationCombobox } from "./relation-combobox";

/** 입력이 필드 밖에서 알아야 하는 값. 편집 화면이 채운다. */
export interface FieldContext {
	/** 편집 중인 콘텐츠 ID. 자기 자신을 관계 대상으로 고르지 않게 한다. */
	entryId?: string;
	disabled: boolean;
	/** 편집 중인 콘텐츠의 언어. 필드 옆 AI 동작이 주소 충돌을 이 언어에서 본다. */
	locale?: string;
	/** 번역 묶음 ID(원문 ID). 반대 방향 관계는 원문을 가리킨다(v2 B2·B4). */
	groupId?: string;
	/** 속성 패널이 이미 불러온 이 글의 사용처. 반대 방향 관계가 같은 글이면 다시 부르지 않는다. */
	incomingReferences?: readonly IncomingReference[];
	incomingReferencesLoading?: boolean;
	refreshIncomingReferences?: () => void;
}

export interface FieldInputProps {
	name: string;
	field: ValueField;
	id: string;
	value: FormValue;
	invalid: boolean;
	describedBy?: string;
	context: FieldContext;
	onChange: (value: FormValue) => void;
}

export const inputClass = "h-8 text-xs md:text-xs";

/** 요약의 여러 줄 입력. */
function AutoSummaryInput({ field, id, value, invalid, describedBy, onChange }: FieldInputProps) {
	const text = typeof value === "string" ? value : "";
	return (
		<Textarea
			id={id}
			rows={3}
			value={text}
			aria-invalid={invalid || undefined}
			aria-describedby={describedBy}
			onChange={(event) => onChange(event.target.value)}
			placeholder={field.kind === "text" ? field.placeholder : undefined}
			className="min-h-16 resize-none text-xs md:text-xs"
		/>
	);
}

/**
 * 입력 등록부(v2 B1). 컬렉션 정의의 `input`이 이 이름을 가리키면 기본 입력 대신 쓴다.
 * 스키마에는 이름만 두고 컴포넌트는 여기에만 둔다(스키마는 서버와 함께 쓰므로 React를 넣지 않는다).
 */
export const FIELD_INPUTS: Readonly<Record<string, ComponentType<FieldInputProps>>> = {
	"auto-summary": AutoSummaryInput,
};

type EntryOption = { id: string; title: string; status: string };

/** 공개 컬렉션(게시글·메모) 제목 검색. 250ms 멈추면 찾는다. */
function useEntrySearch(field: RelationField, search: string, excludeId?: string) {
	const [results, setResults] = useState<EntryOption[]>([]);
	useEffect(() => {
		if (!search.trim()) {
			setResults([]);
			return;
		}
		const timer = setTimeout(() => {
			const params = new URLSearchParams({ collection: field.to, search: search.trim(), pageSize: "25" });
			if (field.publishedOnly) params.set("status", "published");
			cmsFetch<{ items: { id: string; title: string | null; status: string }[] }>(`/api/cms/v1/entries?${params}`)
				.then((data) =>
					setResults(
						data.items
							.filter((item) => item.id !== excludeId)
							.map((item) => ({ id: item.id, title: item.title || "제목 없음", status: item.status })),
					),
				)
				.catch(() => setResults([]));
		}, 250);
		return () => clearTimeout(timer);
	}, [field.to, field.publishedOnly, search, excludeId]);
	return results;
}

function SearchResults({ results, onPick }: { results: EntryOption[]; onPick: (option: EntryOption) => void }) {
	if (results.length === 0) return null;
	return (
		<ul className="max-h-32 overflow-y-auto rounded-md border text-xs">
			{results.map((result) => (
				<li key={result.id}>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						className="w-full justify-start"
						onClick={() => onPick(result)}
					>
						{result.title}
						{result.status !== "published" && ` (${result.status})`}
					</Button>
				</li>
			))}
		</ul>
	);
}

/** 한 개 관계(게시글·메모 대상). 제목으로 찾아 고른다. 대체 글(§6.4)이 쓴다. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const [search, setSearch] = useState("");
	const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
	const results = useEntrySearch(relation, search, context.entryId);
	const selected = typeof value === "string" && value ? value : null;

	useEffect(() => {
		if (!selected) {
			setSelectedTitle(null);
			return;
		}
		cmsFetch<{ working: { metadata: { title?: string } } }>(`/api/cms/v1/entries/${selected}`)
			.then((entry) => setSelectedTitle(entry.working.metadata.title || "제목 없음"))
			.catch(() => setSelectedTitle("(찾을 수 없음)"));
	}, [selected]);

	return (
		<div className="space-y-1.5">
			<p className="text-xs">
				현재: {selectedTitle ?? "지정 안 함"}
				{selected && !context.disabled && (
					<Button type="button" variant="link" size="xs" className="ml-1" onClick={() => onChange(null)}>
						해제
					</Button>
				)}
			</p>
			<Input
				id={id}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy}
				value={search}
				disabled={context.disabled}
				placeholder={relation.placeholder ?? "제목 검색"}
				onChange={(event) => setSearch(event.target.value)}
				className={inputClass}
			/>
			<SearchResults
				results={results}
				onPick={(option) => {
					onChange(option.id);
					setSearch("");
				}}
			/>
		</div>
	);
}

/** 순서 있는 여러 개 관계(게시글 대상). 모음집 항목(§6.4)이 쓴다. */
export function OrderedEntryList({ field, id, value, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const [search, setSearch] = useState("");
	const [known, setKnown] = useState<Record<string, EntryOption>>({});
	const ids = Array.isArray(value) ? value : [];
	const results = useEntrySearch(relation, search, context.entryId);
	const idsKey = ids.join(",");

	// 목록에 처음 보이는 항목의 제목·상태를 읽는다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: idsKey stands in for ids
	useEffect(() => {
		const missing = ids.filter((itemId) => !known[itemId]);
		if (missing.length === 0) return;
		let cancelled = false;
		void Promise.all(
			missing.map((itemId) =>
				cmsFetch<{ status: string; working: { metadata: { title?: string } } }>(`/api/cms/v1/entries/${itemId}`)
					.then((entry) => ({ id: itemId, title: entry.working.metadata.title || "제목 없음", status: entry.status }))
					.catch(() => ({ id: itemId, title: "(찾을 수 없음)", status: "missing" })),
			),
		).then((resolved) => {
			if (!cancelled) setKnown((current) => ({ ...current, ...Object.fromEntries(resolved.map((r) => [r.id, r])) }));
		});
		return () => {
			cancelled = true;
		};
	}, [idsKey]);

	const move = (index: number, direction: -1 | 1) => {
		const next = [...ids];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target] as string, next[index] as string];
		onChange(next);
	};

	return (
		<div className="space-y-2">
			{ids.length === 0 && <p className="text-muted-foreground text-xs">담긴 글이 없습니다.</p>}
			<ol className="space-y-1">
				{ids.map((itemId, index) => {
					const item = known[itemId];
					const title = item?.title ?? "불러오는 중";
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: 같은 글이 두 번 담길 수 있어 순번까지 키로 쓴다
						<li key={`${itemId}-${index}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
							<span className="min-w-0 flex-1 truncate">
								{index + 1}. {title}
								{item && item.status !== "published" && (
									<span className="ml-1 text-amber-700 dark:text-amber-400">
										({item.status === "missing" ? "없음" : "비공개 — 공개 목록에서 빠짐"})
									</span>
								)}
							</span>
							<Button
								type="button"
								size="icon-xs"
								variant="ghost"
								aria-label={`${title} 위로`}
								disabled={context.disabled || index === 0}
								onClick={() => move(index, -1)}
							>
								<ArrowUp />
							</Button>
							<Button
								type="button"
								size="icon-xs"
								variant="ghost"
								aria-label={`${title} 아래로`}
								disabled={context.disabled || index === ids.length - 1}
								onClick={() => move(index, 1)}
							>
								<ArrowDown />
							</Button>
							<Button
								type="button"
								size="icon-xs"
								variant="ghost"
								aria-label={`${title} 빼기`}
								disabled={context.disabled}
								onClick={() => onChange(ids.filter((_, i) => i !== index))}
							>
								<X />
							</Button>
						</li>
					);
				})}
			</ol>
			<FieldLabel htmlFor={id} className="sr-only">
				추가할 글 검색
			</FieldLabel>
			<Input
				id={id}
				value={search}
				disabled={context.disabled}
				placeholder={relation.placeholder ?? "추가할 글 검색"}
				onChange={(event) => setSearch(event.target.value)}
				className={inputClass}
			/>
			<SearchResults
				results={results}
				onPick={(option) => {
					setKnown((current) => ({ ...current, [option.id]: option }));
					onChange([...ids, option.id]);
					setSearch("");
				}}
			/>
		</div>
	);
}

type RecordEntry = {
	id: string;
	version: number;
	workingSlug: string | null;
	working: { metadata: Record<string, unknown> };
};
export type IncomingReference = {
	state: "working" | "published";
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	occurrences: readonly { type: string; path?: string }[];
};

/**
 * 반대 방향 관계 입력(v2 B2). 예: 게시글의 `모음집`. 상대 레코드(모음집)의 여러 개 관계 필드(`itemIds`)를
 * 누르는 즉시 저장한다 — 이 글의 초안·발행과 별개다. 추가하면 끝에 들어가고, 빼면 이 글이 든 자리를 모두 뺀다.
 * 버전이 어긋나면(다른 곳에서 먼저 바뀜) 최신 값을 다시 읽어 한 번 더 시도한다.
 */
export function BacklinkInput({
	field,
	targetId,
	disabled,
	shared,
}: {
	field: BacklinkField;
	/** 이 글의 ID. 번역본이면 원문 ID다(관계는 원문을 가리킨다). 새 글이면 없다. */
	targetId: string | undefined;
	disabled: boolean;
	/** 속성 패널이 불러온 같은 글의 사용처. 있으면 그것을 쓰고, 저장 뒤에는 `refresh`로 다시 부른다. */
	shared?: { references: readonly IncomingReference[]; loading: boolean; refresh: () => void };
}) {
	const records = useTaxonomy(field.from as RecordCollection, Boolean(targetId));
	const [fetched, setFetched] = useState<{ id: string; title: string }[] | null>(null);

	const membersOf = useCallback(
		(references: readonly IncomingReference[]) => {
			const found = new Map<string, string>();
			for (const reference of references) {
				const viaField = reference.occurrences.some((occurrence) => occurrence.path === field.via);
				if (reference.state === "working" && reference.sourceCollection === field.from && viaField) {
					found.set(reference.sourceId, reference.sourceTitle || "이름 없음");
				}
			}
			return [...found].map(([id, title]) => ({ id, title }));
		},
		[field.from, field.via],
	);

	const refreshShared = shared?.refresh;
	const load = useCallback(async () => {
		if (!targetId) return;
		if (refreshShared) {
			refreshShared();
			return;
		}
		try {
			const data = await cmsFetch<{ incomingReferences: IncomingReference[] }>(
				`/api/cms/v1/entries/${targetId}/relations`,
			);
			setFetched(membersOf(data.incomingReferences));
		} catch (loadError) {
			toast.error(errorText(loadError, "목록을 불러오지 못했습니다."));
		}
	}, [targetId, refreshShared, membersOf]);

	// 속성 패널이 같은 글의 사용처를 이미 불러오면 따로 부르지 않는다.
	const usesShared = Boolean(shared);
	useEffect(() => {
		if (!usesShared) void load();
	}, [usesShared, load]);

	const members = shared
		? shared.loading && shared.references.length === 0
			? null
			: membersOf(shared.references)
		: fetched;

	/** 상대 레코드의 관계 목록을 바꿔 바로 저장한다. record 컬렉션은 저장이 곧 공개 반영이다. */
	const update = async (recordId: string, change: (ids: string[]) => string[]) => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const record = await cmsFetch<RecordEntry>(`/api/cms/v1/entries/${recordId}`);
			const current = record.working.metadata[field.via];
			const ids = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
			try {
				await cmsFetch(`/api/cms/v1/entries/${recordId}`, {
					method: "PATCH",
					json: {
						expectedVersion: record.version,
						slug: record.workingSlug,
						metadata: { ...record.working.metadata, [field.via]: change(ids) },
					},
					fallback: "저장하지 못했습니다.",
				});
				return;
			} catch (saveError) {
				if (!(saveError instanceof CmsApiError && saveError.code === "conflict") || attempt === 1) throw saveError;
			}
		}
	};

	// 고르거나 빼면 먼저 화면에 반영하고(낙관적), 저장은 뒤에서 차례로 한다. 실패하면 알리고 그 변경만 되돌린다.
	const [optimistic, setOptimistic] = useState<string[] | null>(null);
	const pendingRef = useRef(0);
	const queueRef = useRef<Promise<void>>(Promise.resolve());
	const awaitingServerRef = useRef(false);
	/** 방금 만들면서 이 글을 넣은 모음집. 다시 저장하지 않는다. */
	const createdRef = useRef(new Set<string>());
	const serverIds = useMemo(() => members?.map((member) => member.id) ?? [], [members]);
	const serverKey = serverIds.join(",");
	const serverIdsRef = useRef(serverIds);
	serverIdsRef.current = serverIds;

	// 저장이 모두 끝난 뒤 서버 값이 도착하면 낙관적 값을 내려놓는다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the server ids
	useEffect(() => {
		if (awaitingServerRef.current && pendingRef.current === 0) {
			awaitingServerRef.current = false;
			setOptimistic(null);
		}
	}, [serverKey]);

	const enqueue = (task: () => Promise<void>, failure: string, revert: (ids: string[]) => string[]) => {
		pendingRef.current += 1;
		queueRef.current = queueRef.current.then(async () => {
			try {
				await task();
			} catch (taskError) {
				toast.error(errorText(taskError, failure));
				setOptimistic((current) => revert(current ?? serverIdsRef.current));
			} finally {
				pendingRef.current -= 1;
				if (pendingRef.current === 0) {
					awaitingServerRef.current = true;
					await load();
				}
			}
		});
	};

	if (!targetId) {
		return <p className="text-muted-foreground text-xs">초안을 저장하면 {field.label}에 넣을 수 있습니다.</p>;
	}

	const shown = optimistic ?? serverIds;
	const options = [
		...records.options.map((option) => ({ value: option.id, label: option.title })),
		// 공개 목록에 아직 없는 모음집(방금 만든 것 등)도 이름으로 보인다.
		...(members ?? [])
			.filter((member) => !records.options.some((option) => option.id === member.id))
			.map((member) => ({ value: member.id, label: member.title })),
	];

	const change = (next: string[]) => {
		const added = next.filter((id) => !shown.includes(id) && !createdRef.current.delete(id));
		const removed = shown.filter((id) => !next.includes(id));
		setOptimistic(next);
		for (const recordId of added) {
			enqueue(
				() => update(recordId, (ids) => (ids.includes(targetId) ? ids : [...ids, targetId])),
				`${field.label}에 넣지 못했습니다.`,
				(ids) => ids.filter((id) => id !== recordId),
			);
		}
		for (const recordId of removed) {
			enqueue(
				() => update(recordId, (ids) => ids.filter((id) => id !== targetId)),
				`${field.label}에서 빼지 못했습니다.`,
				(ids) => (ids.includes(recordId) ? ids : [...ids, recordId]),
			);
		}
	};

	return (
		<RelationCombobox
			multiple
			aria-label={field.label}
			placeholder={members === null ? "불러오는 중..." : "검색하거나 새로 만들기"}
			options={options}
			value={shown}
			disabled={disabled || members === null}
			onValueChange={change}
			onCreate={
				field.createInline
					? async (title) => {
							try {
								// 만들면서 이 글을 넣는다. 목록에 바로 보이게 선택지도 다시 읽는다.
								const created = await cmsFetch<{ id: string }>("/api/cms/v1/entries", {
									method: "POST",
									json: { collection: field.from, metadata: { title, [field.via]: [targetId] }, mdx: "" },
									fallback: "만들지 못했습니다.",
								});
								createdRef.current.add(created.id);
								void records.reload();
								awaitingServerRef.current = true;
								void load();
								return created.id;
							} catch (createError) {
								throw new Error(errorText(createError, "만들지 못했습니다."));
							}
						}
					: undefined
			}
		/>
	);
}
