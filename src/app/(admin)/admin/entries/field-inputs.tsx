"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { BacklinkField, RelationField, ValueField } from "@/cms/schema/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/cn";
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

/** 목록 API 한 번에 받는 최대 수. 글이 이보다 많으면 여러 번 나눠 받는다. */
const ENTRY_OPTIONS_PAGE_SIZE = 100;

/**
 * 관계 대상(게시글·메모)의 전체 목록. 고를 때 검색 없이 바로 펼쳐 보이려고 처음에 한 번 다 받는다.
 * 휴지통 글은 목록 API가 빼고, `publishedOnly`면 공개 글만 받는다.
 */
function useEntryOptions(field: RelationField) {
	const [options, setOptions] = useState<EntryOption[] | null>(null);
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const all: EntryOption[] = [];
			for (let page = 1; ; page += 1) {
				const params = new URLSearchParams({
					collection: field.to,
					pageSize: String(ENTRY_OPTIONS_PAGE_SIZE),
					page: String(page),
				});
				if (field.publishedOnly) params.set("status", "published");
				const data = await cmsFetch<{ items: { id: string; title: string | null; status: string }[]; total: number }>(
					`/api/cms/v1/entries?${params}`,
				);
				all.push(...data.items.map((item) => ({ id: item.id, title: item.title || "제목 없음", status: item.status })));
				if (data.items.length === 0 || all.length >= data.total) break;
			}
			return all;
		};
		load()
			.then((loaded) => !cancelled && setOptions(loaded))
			.catch(() => !cancelled && setOptions([]));
		return () => {
			cancelled = true;
		};
	}, [field.to, field.publishedOnly]);
	return options;
}

/** 공개되지 않은 글은 이름 뒤에 표시한다. 모음집·대체 글의 공개 목록에서 빠지기 때문이다. */
const entryLabel = (option: EntryOption) => (option.status === "published" ? option.title : `${option.title} · 비공개`);

/** 한 개 관계(게시글·메모 대상). 누르면 전체 글 목록이 열리고 고른다. 대체 글(§6.4)이 쓴다. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const options = useEntryOptions(relation);
	const selected = typeof value === "string" && value ? [value] : [];
	return (
		<RelationCombobox
			id={id}
			aria-label={field.label}
			placeholder={options === null ? "불러오는 중…" : (relation.placeholder ?? "글 고르기")}
			invalid={invalid}
			describedBy={describedBy}
			disabled={context.disabled || options === null}
			multiple={false}
			options={(options ?? [])
				.filter((option) => option.id !== context.entryId)
				.map((option) => ({ value: option.id, label: entryLabel(option) }))}
			value={selected}
			onValueChange={(next) => onChange(next[0] ?? null)}
		/>
	);
}

/** 순서 있는 목록의 한 줄. 손잡이를 끌거나 위로·아래로 버튼으로 옮긴다. */
function SortableEntryRow({
	sortableId,
	index,
	count,
	option,
	disabled,
	onMove,
	onRemove,
}: {
	sortableId: string;
	index: number;
	count: number;
	option: EntryOption | undefined;
	disabled: boolean;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: sortableId,
		disabled,
	});
	const title = option?.title ?? "불러오는 중";
	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"flex items-center gap-1 rounded-md border bg-background px-1 py-1 text-xs",
				isDragging && "relative z-10 shadow-md",
			)}
		>
			<Button
				ref={setActivatorNodeRef}
				type="button"
				size="icon-xs"
				variant="ghost"
				aria-label={`${title} 끌어서 옮기기`}
				disabled={disabled}
				className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</Button>
			<span className="min-w-0 flex-1 truncate">
				{index + 1}. {title}
				{option && option.status !== "published" && (
					<span className="ml-1 text-amber-700 dark:text-amber-400">
						({option.status === "missing" ? "없음" : "비공개 — 공개 목록에서 빠짐"})
					</span>
				)}
			</span>
			<Button
				type="button"
				size="icon-xs"
				variant="ghost"
				aria-label={`${title} 위로`}
				disabled={disabled || index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp />
			</Button>
			<Button
				type="button"
				size="icon-xs"
				variant="ghost"
				aria-label={`${title} 아래로`}
				disabled={disabled || index === count - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown />
			</Button>
			<Button
				type="button"
				size="icon-xs"
				variant="ghost"
				aria-label={`${title} 빼기`}
				disabled={disabled}
				onClick={onRemove}
			>
				<X />
			</Button>
		</li>
	);
}

/**
 * 순서 있는 여러 개 관계(게시글 대상). 모음집 항목(§6.4)이 쓴다.
 * 위의 `글 추가·빼기` 목록에서 체크해 넣고 빼며(넣으면 끝에 붙는다), 아래 목록에서 끌어서 순서를 바꾼다.
 */
export function OrderedEntryList({ field, id, value, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const options = useEntryOptions(relation);
	const ids = Array.isArray(value) ? value : [];
	const byId = useMemo(() => new Map((options ?? []).map((option) => [option.id, option])), [options]);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	// 같은 글이 두 번 담길 수 있어(이전 데이터) 순번까지 끌기 ID로 쓴다.
	const sortableIds = ids.map((itemId, index) => `${index}:${itemId}`);

	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= ids.length) return;
		onChange(arrayMove([...ids], index, target));
	};
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		onChange(arrayMove([...ids], sortableIds.indexOf(String(active.id)), sortableIds.indexOf(String(over.id))));
	};
	/** 체크 목록이 돌려준 선택. 남은 글은 지금 순서를 지키고 새 글은 끝에 붙인다. */
	const applySelection = (selected: string[]) => {
		const chosen = new Set(selected);
		const kept = ids.filter((itemId) => chosen.has(itemId));
		onChange([...kept, ...selected.filter((itemId) => !ids.includes(itemId))]);
	};
	const missing = (itemId: string): EntryOption | undefined =>
		options === null ? undefined : { id: itemId, title: "(찾을 수 없음)", status: "missing" };

	return (
		<div className="space-y-2">
			<RelationCombobox
				id={id}
				aria-label="글 추가·빼기"
				placeholder={options === null ? "불러오는 중…" : (relation.placeholder ?? "글 추가·빼기")}
				disabled={context.disabled || options === null}
				multiple
				showChips={false}
				options={(options ?? [])
					.filter((option) => option.id !== context.entryId)
					.map((option) => ({ value: option.id, label: entryLabel(option) }))}
				value={ids}
				onValueChange={applySelection}
			/>
			{ids.length === 0 ? (
				<p className="text-muted-foreground text-xs">담긴 글이 없습니다.</p>
			) : (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
					<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
						<ol aria-label="담긴 글" className="space-y-1">
							{ids.map((itemId, index) => (
								<SortableEntryRow
									key={sortableIds[index]}
									sortableId={sortableIds[index] as string}
									index={index}
									count={ids.length}
									option={byId.get(itemId) ?? missing(itemId)}
									disabled={context.disabled}
									onMove={(direction) => move(index, direction)}
									onRemove={() => onChange(ids.filter((_, i) => i !== index))}
								/>
							))}
						</ol>
					</SortableContext>
				</DndContext>
			)}
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
