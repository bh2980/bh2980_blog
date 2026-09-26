"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminListColumn } from "@/cms/core/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/cn";
import { COLUMN_CONFIG, type ColumnFilter, isColumnFiltered } from "./list-columns";
import { LIST_STATUSES, type ListState } from "./list-state";
import { DateRangeCalendar } from "./shared/date-range-picker";
import { STATUS_LABELS } from "./shared/entry-status";
import type { TaxonomyOption } from "./shared/use-taxonomy";

function TextFilter({
	value,
	placeholder,
	label,
	onApply,
}: {
	value: string;
	placeholder: string;
	label: string;
	onApply: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<form
			className="flex gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				onApply(draft);
			}}
		>
			<Input
				aria-label={`${label} 필터`}
				value={draft}
				placeholder={placeholder}
				onChange={(event) => setDraft(event.target.value)}
				className="h-8"
			/>
			<Button type="submit" size="sm">
				적용
			</Button>
		</form>
	);
}

function CheckRow({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (next: boolean) => void;
}) {
	return (
		<Label className="flex items-center gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-accent">
			<Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
			{label}
		</Label>
	);
}

function StatusFilter({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	const toggle = (status: (typeof LIST_STATUSES)[number], on: boolean) =>
		onChange({ statuses: on ? [...state.statuses, status] : state.statuses.filter((item) => item !== status) });
	return (
		<fieldset className="space-y-0.5">
			<legend className="sr-only">상태 — 여러 개를 고르면 하나라도 맞는 항목을 보여 줍니다</legend>
			{LIST_STATUSES.map((status) => (
				<CheckRow
					key={status}
					label={STATUS_LABELS[status]}
					checked={state.statuses.includes(status)}
					onChange={(on) => toggle(status, on)}
				/>
			))}
			<Separator className="my-1" />
			<CheckRow label="수정 중" checked={state.hasChanges} onChange={(on) => onChange({ hasChanges: on })} />
			<CheckRow label="예약됨" checked={state.scheduled} onChange={(on) => onChange({ scheduled: on })} />
		</fieldset>
	);
}

function TaxonomyFilter({
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
	const toggle = (id: string) =>
		onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
	return (
		<div className="space-y-2">
			<Command className="rounded-md border">
				<CommandInput placeholder={`${label} 검색`} aria-label={`${label} 검색`} />
				<CommandList className="max-h-56">
					<CommandEmpty>일치하는 {label}가 없습니다.</CommandEmpty>
					<CommandGroup>
						{options.map((option) => (
							<CommandItem key={option.id} value={`${option.title} ${option.id}`} onSelect={() => toggle(option.id)}>
								<Checkbox
									checked={selected.includes(option.id)}
									tabIndex={-1}
									aria-hidden
									className="pointer-events-none"
								/>
								{option.title}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
			<div className="flex justify-between">
				<Button type="button" variant="ghost" size="sm" onClick={() => onChange(options.map((option) => option.id))}>
					모두 선택
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
					모두 해제
				</Button>
			</div>
		</div>
	);
}

function DateFilter({
	label,
	from,
	to,
	onChange,
}: {
	label: string;
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
}) {
	return (
		<div className="space-y-2">
			<p className="px-1 text-muted-foreground text-xs">{label} 범위(서울 날짜). 시작일과 끝날을 차례로 누르세요.</p>
			<DateRangeCalendar from={from} to={to} onChange={onChange} />
			<p className="px-1 text-xs" aria-live="polite">
				{from || to ? `${from || "처음"} ~ ${to || "끝"}` : "기간을 고르지 않았습니다."}
			</p>
		</div>
	);
}

/** 이 필터를 지우는 변경. 칩의 `✕`와 팝업의 `필터 지우기`가 쓴다. */
export function clearPatchFor(filter: ColumnFilter): Partial<ListState> {
	switch (filter.kind) {
		case "text":
			return { [filter.key]: "" };
		case "status":
			return { statuses: [], hasChanges: false, scheduled: false };
		case "taxonomy":
			return { [filter.key]: [] };
		case "date":
			return { [filter.from]: "", [filter.to]: "" };
		case "none":
			return {};
	}
}

/**
 * 엑셀처럼 컬럼 헤더에서 여는 정렬·필터 팝업(v2 A1). 필터가 걸린 헤더는 아이콘 모양이 바뀌어
 * 색만으로 상태를 전달하지 않는다. 정렬 가능한 컬럼은 `aria-sort`를 헤더 셀에 둔다(호출하는 쪽).
 */
export function ColumnHeader({
	column,
	filter,
	state,
	options,
	onChange,
}: {
	column: AdminListColumn;
	filter: ColumnFilter;
	state: ListState;
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] };
	onChange: (patch: Partial<ListState>) => void;
}) {
	const config = COLUMN_CONFIG[column];
	const sortField = config.sortField;
	const filtered = isColumnFiltered(state, filter);
	const sorted = sortField && state.sortField === sortField ? state.sortDirection : null;
	if (!sortField && filter.kind === "none") return <span>{config.label}</span>;

	const sortButton = (direction: "asc" | "desc") => (
		<Button
			type="button"
			variant={sorted === direction ? "secondary" : "ghost"}
			size="sm"
			aria-pressed={sorted === direction}
			className="justify-start"
			onClick={() => sortField && onChange({ sortField, sortDirection: direction })}
		>
			{direction === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
			{direction === "asc" ? "오름차순" : "내림차순"}
		</Button>
	);

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn("-ml-2 h-7 gap-1 px-2 font-medium text-muted-foreground", filtered && "text-foreground")}
						aria-label={`${config.label}${sorted ? `, ${sorted === "asc" ? "오름차순" : "내림차순"} 정렬` : ""}${filtered ? ", 필터 적용됨" : ""} — 정렬·필터 열기`}
					/>
				}
			>
				{config.label}
				{sorted === "asc" && <ArrowUpNarrowWide aria-hidden className="size-3.5" />}
				{sorted === "desc" && <ArrowDownWideNarrow aria-hidden className="size-3.5" />}
				{filtered ? (
					<ListFilter aria-hidden className="size-3.5 fill-current" data-filtered="" />
				) : (
					<ChevronDown aria-hidden className="size-3.5 opacity-60" />
				)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 space-y-3 p-3">
				{sortField && (
					<fieldset className="flex flex-col gap-1">
						<legend className="sr-only">{config.label} 정렬</legend>
						{sortButton("asc")}
						{sortButton("desc")}
					</fieldset>
				)}
				{sortField && filter.kind !== "none" && <Separator />}
				{filter.kind === "text" && (
					<TextFilter
						value={state[filter.key]}
						placeholder={filter.placeholder}
						label={config.label}
						onApply={(value) => onChange({ [filter.key]: value })}
					/>
				)}
				{filter.kind === "status" && <StatusFilter state={state} onChange={onChange} />}
				{filter.kind === "taxonomy" && (
					<TaxonomyFilter
						label={config.label}
						options={filter.source === "tag" ? options.tags : options.categories}
						selected={state[filter.key]}
						onChange={(ids) => onChange({ [filter.key]: ids })}
					/>
				)}
				{filter.kind === "date" && (
					<DateFilter
						label={config.label}
						from={state[filter.from]}
						to={state[filter.to]}
						onChange={(from, to) => onChange({ [filter.from]: from, [filter.to]: to })}
					/>
				)}
				{filtered && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() => onChange(clearPatchFor(filter))}
					>
						{config.label} 필터 지우기
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
