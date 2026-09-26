"use client";

import { Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

/** 목록 위 도구 막대: 전체 검색, 저장된 보기, 새로 만들기, 적용된 필터 칩. */
export function ListToolbar({
	state,
	options,
	onChange,
	onCreateNew,
	views,
	searchOnly = false,
}: {
	state: ListState;
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] };
	onChange: (patch: Partial<ListState>) => void;
	onCreateNew?: () => void;
	views?: ReactNode;
	/** 휴지통 화면처럼 검색만 두는 경우. */
	searchOnly?: boolean;
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
	const chips = filterChips(state, options);

	return (
		<div className="space-y-2 border-b px-4 py-3 lg:px-6">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					type="search"
					aria-label="제목·주소 검색"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={state.includeBody ? "제목·주소·본문 검색" : "제목·주소 검색"}
					className="h-8 w-60"
				/>
				{isContent && !searchOnly && (
					<Label className="font-normal text-muted-foreground text-xs">
						<Checkbox
							checked={state.includeBody}
							onCheckedChange={(checked) => onChange({ includeBody: checked === true })}
						/>
						본문 포함
					</Label>
				)}
				<div className="ml-auto flex items-center gap-2">
					{views}
					{onCreateNew && (
						<Button type="button" size="sm" onClick={onCreateNew}>
							<Plus aria-hidden />
							새로 만들기
						</Button>
					)}
				</div>
			</div>
			{chips.length > 0 && (
				<ul aria-label="적용된 필터" className="flex flex-wrap items-center gap-1.5">
					{chips.map((chip) => (
						<li key={chip.key}>
							<Badge variant="secondary" className="h-6 gap-1 pr-0.5">
								<span className="max-w-72 truncate">{chip.label}</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									aria-label={`${chip.label} 필터 지우기`}
									onClick={() => onChange(chip.clear)}
								>
									<X aria-hidden />
								</Button>
							</Badge>
						</li>
					))}
					<li>
						<Button
							type="button"
							variant="ghost"
							size="xs"
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
			)}
		</div>
	);
}
