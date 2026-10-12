"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslate } from "@/libs/i18n/use-locale";

export type ShelfTag = { slug: string; label: string; count: number };

type MemoShelfProps = {
	tags: ShelfTag[];
	/** 고른 태그. 없으면 전체 */
	picked: string | null;
	/** 찾는 말에 걸리는 태그. 비어 있는 검색이면 전부 걸린다 */
	matched: ReadonlySet<string>;
	onPick: (slug: string | null) => void;
};

const SHELF_GAP = 6;
const SHELF_PADDING = 8;

/** 책등 너비: 메모가 많을수록 두꺼워지되 68px에서 멈춘다 */
const spineWidth = (count: number) => Math.round(Math.min(30 + 12 * Math.log2(count + 1), 68));

/** 책 높이: 순서로 정하는 고정 값이라 서버·클라이언트가 같다 (160~219px) */
const spineHeight = (index: number) => 160 + ((index * 37) % 60);

/** 색 변주: 대부분 기본, 가끔 전경색·강조색 */
const spineTone = (index: number) => {
	if (index % 7 === 3) return "border-foreground bg-foreground text-background";
	if (index % 11 === 5) return "border-primary bg-primary text-background";
	return "border-border bg-muted text-foreground";
};

/** 책장에는 한 줄에 들어가는 만큼만 꽂는다. 메모가 많은 태그부터 고르되, 꽂는 순서는 색인 순서 그대로다. */
const pickVisible = (tags: ShelfTag[], width: number | null, picked: string | null) => {
	if (width === null) return tags;

	const room = width - SHELF_PADDING;
	const byCount = [...tags].sort((a, b) => b.count - a.count);
	// 고른 책은 줄이 넘쳐도 꼭 보이게 맨 앞에 둔다
	byCount.sort((a, b) => Number(b.slug === picked) - Number(a.slug === picked));

	const chosen = new Set<string>();
	let used = 0;
	for (const tag of byCount) {
		const next = used + spineWidth(tag.count) + SHELF_GAP;
		if (next > room && chosen.size > 0 && tag.slug !== picked) continue;
		chosen.add(tag.slug);
		used = next;
	}

	return tags.filter((tag) => chosen.has(tag.slug));
};

export const MemoShelf = ({ tags, picked, matched, onPick }: MemoShelfProps) => {
	const { t } = useTranslate();
	const wrapRef = useRef<HTMLDivElement>(null);
	// 측정 전(서버 렌더)에는 null: 전부 그리고 가로로 스크롤한다
	const [width, setWidth] = useState<number | null>(null);

	useEffect(() => {
		const element = wrapRef.current;
		if (!element) return;

		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	const visible = useMemo(() => pickVisible(tags, width, picked), [tags, width, picked]);

	return (
		<div ref={wrapRef} className="overflow-x-auto pt-16">
			{/* biome-ignore lint/a11y/useSemanticElements: fieldset은 크롬에서 안쪽 상자가 정한 높이까지 늘지 않아 책이 선반 위에 뜬다 */}
			<div
				role="group"
				aria-label={t("memos.shelf")}
				className="flex min-h-[240px] w-max min-w-full items-end gap-1.5 border-foreground border-b-[3px] px-1"
			>
				{visible.map((tag, index) => {
					const isPicked = picked === tag.slug;
					const dim = picked ? !isPicked : !matched.has(tag.slug);

					return (
						<button
							key={tag.slug}
							type="button"
							aria-pressed={isPicked}
							onClick={() => onPick(isPicked ? null : tag.slug)}
							style={{ width: spineWidth(tag.count), height: spineHeight(index), writingMode: "vertical-rl" }}
							className={`flex flex-none cursor-pointer items-center justify-between gap-4 border px-0 pt-6 pb-4 font-semibold text-sm leading-none tracking-[0.06em] transition-[transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none ${spineTone(index)} ${isPicked ? "-translate-y-5" : ""} ${dim ? "opacity-25" : ""}`}
						>
							<span>{tag.label}</span>
							<small className="font-light text-[11px] tabular-nums opacity-70">{tag.count}</small>
						</button>
					);
				})}
			</div>
		</div>
	);
};
