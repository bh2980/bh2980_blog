"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import type { RelationField, ValueField } from "@/cms/schema/fields";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cmsFetch } from "../admin-api";
import type { FormValue } from "./entry-form";

/** 입력이 필드 밖에서 알아야 하는 값. 편집 화면이 채운다. */
export interface FieldContext {
	/** 편집 중인 콘텐츠 ID. 자기 자신을 관계 대상으로 고르지 않게 한다. */
	entryId?: string;
	/** 요약이 비었을 때 발행하면 쓸 자동 요약(§5.6). */
	autoSummaryPreview?: string;
	disabled: boolean;
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

/** 요약: 여러 줄 입력 + 비었을 때 발행하면 만들 자동 요약 미리보기(§5.6). */
function AutoSummaryInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const text = typeof value === "string" ? value : "";
	const preview = context.autoSummaryPreview ?? "";
	return (
		<>
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
			{!text.trim() && (
				<p className="text-[11px] text-muted-foreground leading-tight">
					{preview ? (
						<>
							<span className="font-medium">비워 두면 발행할 때 본문에서 만듭니다:</span> {preview}
						</>
					) : (
						"요약을 만들 본문이 없습니다. 발행하려면 직접 입력하세요."
					)}
				</p>
			)}
		</>
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
