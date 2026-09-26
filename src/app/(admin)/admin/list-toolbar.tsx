"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { clearPatchFor } from "./column-header";
import { COLUMN_CONFIG, type ColumnFilter, columnsFor, filterFor, isColumnFiltered } from "./list-columns";
import { clearFilters, type ListState } from "./list-state";
import { STATUS_LABELS } from "./shared/entry-status";
import type { TaxonomyOption } from "./shared/use-taxonomy";

export interface FilterChip {
	key: string;
	label: string;
	clear: Partial<ListState>;
}

const nameOf = (options: TaxonomyOption[], id: string) =>
	options.find((option) => option.id === id)?.title ?? "알 수 없음";

function describe(
	filter: ColumnFilter,
	state: ListState,
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] },
) {
	switch (filter.kind) {
		case "text":
			return `"${state[filter.key].trim()}"`;
		case "status":
			return [
				...state.statuses.map((status) => STATUS_LABELS[status]),
				...(state.hasChanges ? ["수정 중"] : []),
				...(state.scheduled ? ["예약됨"] : []),
			].join(", ");
		case "taxonomy": {
			const source = filter.source === "tag" ? options.tags : options.categories;
			return state[filter.key].map((id) => nameOf(source, id)).join(", ");
		}
		case "date":
			return `${state[filter.from] || "처음"} ~ ${state[filter.to] || "끝"}`;
		case "none":
			return "";
	}
}

/**
 * 적용된 필터 칩(v2 A1). 컬럼을 숨겨도 그 컬럼에 걸린 필터는 칩으로 계속 보여
 * "왜 글이 안 보이지?"를 막는다.
 */
export function filterChips(
	state: ListState,
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] },
): FilterChip[] {
	const chips: FilterChip[] = [];
	if (state.search.trim()) {
		chips.push({
			key: "search",
			label: `검색${state.includeBody ? "(본문 포함)" : ""}: "${state.search.trim()}"`,
			clear: { search: "", includeBody: false },
		});
	}
	for (const column of columnsFor(state.collection).available) {
		const filter = filterFor(state.collection, column);
		if (!isColumnFiltered(state, filter)) continue;
		chips.push({
			key: column,
			label: `${COLUMN_CONFIG[column].label}: ${describe(filter, state, options)}`,
			clear: clearPatchFor(filter),
		});
	}
	return chips;
}

/** 머리글의 검색칸(§3.2). 입력이 멈추면 서버 검색을 보낸다. 게시글·메모는 본문 검색을 켤 수 있다. */
export function ListSearch({
	state,
	onChange,
	allowBody = true,
}: {
	state: ListState;
	onChange: (patch: Partial<ListState>) => void;
	allowBody?: boolean;
}) {
	const [search, setSearch] = useState(state.search);
	useEffect(() => setSearch(state.search), [state.search]);
	useEffect(() => {
		if (search === state.search) return;
		const timer = setTimeout(() => onChange({ search }), 300);
		return () => clearTimeout(timer);
	}, [search, state.search, onChange]);

	const isContent = state.collection === "post" || state.collection === "memo";
	return (
		<div className="flex items-center gap-3">
			<InputGroup className="h-8 w-64">
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput
					type="search"
					aria-label="제목·주소 검색"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={state.includeBody ? "제목·주소·본문 검색" : "제목·주소 검색"}
				/>
			</InputGroup>
			{isContent && allowBody && (
				<Label className="font-normal text-muted-foreground text-xs">
					<Checkbox
						checked={state.includeBody}
						onCheckedChange={(checked) => onChange({ includeBody: checked === true })}
					/>
					본문 포함
				</Label>
			)}
		</div>
	);
}

/** 적용된 필터 칩 줄. 필터가 하나도 없으면 그리지 않는다. */
export function FilterChipBar({
	state,
	options,
	onChange,
}: {
	state: ListState;
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] };
	onChange: (patch: Partial<ListState>) => void;
}) {
	const chips = filterChips(state, options);
	if (chips.length === 0) return null;
	return (
		<ul aria-label="적용된 필터" className="flex min-h-11 flex-wrap items-center gap-1.5 border-b px-5 py-2">
			{chips.map((chip) => (
				<li key={chip.key}>
					<span className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 pr-0.5 pl-2 font-medium text-primary text-xs">
						<span className="max-w-72 truncate">{chip.label}</span>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="size-5 text-primary hover:bg-primary/15 hover:text-primary"
							aria-label={`${chip.label} 필터 지우기`}
							onClick={() => onChange(chip.clear)}
						>
							<X aria-hidden />
						</Button>
					</span>
				</li>
			))}
			<li>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="text-muted-foreground"
					onClick={() => {
						const {
							collection: _c,
							folder: _f,
							includeDescendants: _d,
							pageSize: _p,
							...cleared
						} = clearFilters(state);
						onChange(cleared);
					}}
				>
					모두 지우기
				</Button>
			</li>
		</ul>
	);
}
