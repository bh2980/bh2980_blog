"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { activeFilterCount, DEFAULT_LIST_STATE, type ListState } from "./list-state";
import { STATUS_LABELS } from "./shared/entry-status";
import type { TaxonomyOption } from "./shared/use-taxonomy";

const DATE_FIELDS = [
	{ label: "생성일", from: "createdFrom", to: "createdTo" },
	{ label: "수정일", from: "updatedFrom", to: "updatedTo" },
	{ label: "발행일", from: "publishedFrom", to: "publishedTo" },
] as const;

const controlClass =
	"h-auto rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-200 text-sm shadow-none dark:bg-neutral-900";

function MultiSelect({
	label,
	options,
	selected,
	onChange,
}: {
	label: string;
	options: TaxonomyOption[];
	selected: string[];
	onChange: (ids: string[]) => void;
}) {
	return (
		<details className="relative">
			<summary className={`${controlClass} cursor-pointer select-none`}>
				{label}
				{selected.length > 0 ? ` (${selected.length})` : ""}
			</summary>
			<fieldset className="absolute z-40 mt-2 max-h-64 w-56 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl">
				<legend className="sr-only">{label} 필터 — 여러 개를 고르면 하나라도 맞는 항목을 보여 줍니다</legend>
				{options.length === 0 && <p className="text-neutral-500 text-xs">항목이 없습니다.</p>}
				{options.map((option) => (
					<label key={option.id} className="flex items-center gap-2 px-1 py-0.5 text-neutral-200 text-sm">
						<input
							type="checkbox"
							checked={selected.includes(option.id)}
							onChange={() =>
								onChange(
									selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id],
								)
							}
						/>
						{option.title}
					</label>
				))}
			</fieldset>
		</details>
	);
}

/** 목록 검색·필터(§3.2). 다른 필터끼리는 AND, 같은 필터의 여러 값은 OR다. */
export function ListFilters({
	state,
	tags,
	categories,
	onChange,
	onCreateNew,
}: {
	state: ListState;
	tags: TaxonomyOption[];
	categories: TaxonomyOption[];
	onChange: (patch: Partial<ListState>) => void;
	onCreateNew: () => void;
}) {
	const [search, setSearch] = useState(state.search);
	useEffect(() => setSearch(state.search), [state.search]);
	// 입력이 멈추면 서버 검색을 한 번 보낸다.
	useEffect(() => {
		if (search === state.search) return;
		const timer = setTimeout(() => onChange({ search }), 300);
		return () => clearTimeout(timer);
	}, [search, state.search, onChange]);

	const isContent = state.collection === "post" || state.collection === "memo";
	const filters = activeFilterCount(state);

	return (
		<div className="flex flex-wrap items-center gap-2 border-neutral-800 border-b px-6 py-3">
			<label htmlFor="list-search" className="sr-only">
				제목·주소 검색
			</label>
			<Input
				id="list-search"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder={state.includeBody ? "제목·주소·본문 검색" : "제목·주소 검색"}
				className={`${controlClass} w-60`}
			/>
			{isContent && (
				<label className="flex items-center gap-1.5 text-neutral-300 text-xs">
					<input
						type="checkbox"
						checked={state.includeBody}
						onChange={(event) => onChange({ includeBody: event.target.checked })}
					/>
					본문 포함
				</label>
			)}
			<NativeSelect
				aria-label="상태 필터"
				value={state.status}
				onChange={(event) => onChange({ status: event.target.value as ListState["status"] })}
				className={`${controlClass} pr-9`}
			>
				<option value="">전체 (휴지통 제외)</option>
				{(isContent
					? (["draft", "published", "archived", "trashed"] as const)
					: (["published", "trashed"] as const)
				).map((status) => (
					<option key={status} value={status}>
						{status === "published" && !isContent ? "활성" : STATUS_LABELS[status]}
					</option>
				))}
			</NativeSelect>
			{isContent && (
				<>
					<label className="flex items-center gap-1.5 text-neutral-300 text-xs">
						<input
							type="checkbox"
							checked={state.hasChanges}
							onChange={(event) => onChange({ hasChanges: event.target.checked })}
						/>
						수정 중
					</label>
					<label className="flex items-center gap-1.5 text-neutral-300 text-xs">
						<input
							type="checkbox"
							checked={state.scheduled}
							onChange={(event) => onChange({ scheduled: event.target.checked })}
						/>
						예약됨
					</label>
					<MultiSelect
						label="태그"
						options={tags}
						selected={state.tagIds}
						onChange={(tagIds) => onChange({ tagIds })}
					/>
				</>
			)}
			{state.collection === "post" && (
				<MultiSelect
					label="카테고리"
					options={categories}
					selected={state.categoryIds}
					onChange={(categoryIds) => onChange({ categoryIds })}
				/>
			)}
			<details className="relative">
				<summary className={`${controlClass} cursor-pointer select-none`}>기간</summary>
				<div className="absolute z-40 mt-2 w-72 space-y-2 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
					{DATE_FIELDS.filter((field) => isContent || field.from !== "publishedFrom").map((field) => (
						<fieldset key={field.label} className="space-y-1">
							<legend className="text-neutral-400 text-xs">{field.label} (서울 날짜)</legend>
							<div className="flex items-center gap-1">
								<input
									type="date"
									aria-label={`${field.label} 시작`}
									value={state[field.from]}
									onChange={(event) => onChange({ [field.from]: event.target.value })}
									className="rounded border border-neutral-700 bg-neutral-950 px-1 text-xs"
								/>
								~
								<input
									type="date"
									aria-label={`${field.label} 끝`}
									value={state[field.to]}
									onChange={(event) => onChange({ [field.to]: event.target.value })}
									className="rounded border border-neutral-700 bg-neutral-950 px-1 text-xs"
								/>
							</div>
						</fieldset>
					))}
				</div>
			</details>
			{(filters > 0 || state.search) && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 text-neutral-400 text-xs"
					onClick={() =>
						onChange({
							search: "",
							status: "",
							hasChanges: false,
							scheduled: false,
							tagIds: [],
							categoryIds: [],
							createdFrom: DEFAULT_LIST_STATE.createdFrom,
							createdTo: "",
							updatedFrom: "",
							updatedTo: "",
							publishedFrom: "",
							publishedTo: "",
						})
					}
				>
					필터 초기화
				</Button>
			)}
			<Button
				type="button"
				onClick={onCreateNew}
				className="ml-auto h-auto rounded-lg bg-white px-4 py-1.5 font-semibold text-neutral-950 text-sm hover:bg-neutral-200"
			>
				+ 새로 만들기
			</Button>
		</div>
	);
}
