"use client";

import type { Route } from "next";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense, useMemo, useState } from "react";
import { useTranslate } from "@/libs/i18n/use-locale";
import { MemoShelf, type ShelfTag } from "./memo-shelf.client";

/** 서버에서 주소·날짜를 미리 만들어 넘긴 메모 한 건 */
export type MemoItem = {
	slug: string;
	title: string;
	href: string;
	/** `yy. MM` */
	date: string;
	tags: { slug: string; label: string }[];
};

type MemoListProps = { memos: MemoItem[] };

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
// 쌍자음은 짝이 되는 평자음 묶음에 넣는다
const INITIAL_GROUP: Record<string, string> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };

type GroupKey = { key: string; rank: number };

/** 색인 묶음 글자: 라틴은 대문자, 한글은 초성, 나머지는 `#` */
const groupKeyOf = (label: string): GroupKey => {
	const first = label.trim().charAt(0);
	if (/[a-z]/i.test(first)) return { key: first.toUpperCase(), rank: 0 };

	const code = first.charCodeAt(0);
	if (code >= HANGUL_START && code <= HANGUL_END) {
		const initial = INITIALS[Math.floor((code - HANGUL_START) / 588)];
		return { key: INITIAL_GROUP[initial] ?? initial, rank: 1 };
	}

	return { key: "#", rank: 2 };
};

type TagEntry = { tag: { slug: string; label: string }; memos: MemoItem[] };
/** 색인에 그리는 한 낱말. `see`는 이 낱말에 통째로 들어 있어 따로 모아 둔 낱말(책 색인의 "→ 보라")이다. */
type IndexEntry = TagEntry & { see: TagEntry[] };
type Group = { key: string; rank: number; entries: IndexEntry[] };

/** 다른 낱말에 통째로 들어 있을 때 "→ 보라"로 접는 최소 메모 수. 한두 개는 그냥 겹쳐 싣는 편이 찾기 쉽다. */
const SEE_ALSO_MIN = 3;

/**
 * 태그 B의 메모 안에 태그 A의 메모가 모두 들어 있으면(예: Type Challenges ⊂ TypeScript) B 아래에는 A의 메모를 다시 싣지 않고
 * "→ A"로 잇는다. 두 태그의 메모가 똑같으면 이름 순으로 앞선 쪽에 싣고 뒤쪽이 잇는다.
 */
const seeAlsoMap = (entries: TagEntry[]) => {
	const sets = new Map(entries.map((entry) => [entry.tag.slug, new Set(entry.memos.map((memo) => memo.slug))]));
	const map = new Map<string, TagEntry[]>();
	for (const outer of entries) {
		const outerSet = sets.get(outer.tag.slug) as Set<string>;
		for (const inner of entries) {
			if (inner === outer || inner.memos.length < SEE_ALSO_MIN) continue;
			const innerSet = sets.get(inner.tag.slug) as Set<string>;
			if (innerSet.size > outerSet.size || ![...innerSet].every((slug) => outerSet.has(slug))) continue;
			if (innerSet.size === outerSet.size && inner.tag.label.localeCompare(outer.tag.label, "ko") > 0) continue;
			map.set(outer.tag.slug, [...(map.get(outer.tag.slug) ?? []), inner]);
		}
	}
	return map;
};

const compareGroup = (a: GroupKey, b: GroupKey) => a.rank - b.rank || a.key.localeCompare(b.key, "ko");

const MemoRow = ({ memo }: { memo: MemoItem }) => (
	<li className="flex items-baseline gap-4 py-1 pl-4 text-[14.5px] leading-relaxed">
		<Link
			href={memo.href as Route}
			className="min-w-0 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
		>
			{memo.title}
		</Link>
		<span className="ml-auto shrink-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums">{memo.date}</span>
	</li>
);

const MemoListContent = ({
	memos,
	picked,
	setPicked,
}: MemoListProps & {
	picked: string | null;
	setPicked: (slug: string | null) => void;
}) => {
	const { t } = useTranslate();
	const [query, setQuery] = useState("");
	const q = query.trim().toLowerCase();

	// 메모가 하나라도 있는 태그와 그 메모들
	const entries = useMemo(() => {
		const map = new Map<string, TagEntry>();
		for (const memo of memos) {
			for (const tag of memo.tags) {
				const entry = map.get(tag.slug) ?? { tag, memos: [] };
				entry.memos.push(memo);
				map.set(tag.slug, entry);
			}
		}
		// 책 색인처럼 한 낱말 아래 메모는 제목 가나다·ABC 순이다
		for (const entry of map.values())
			entry.memos.sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true }));
		return [...map.values()];
	}, [memos]);

	// 찾는 말이 있으면: 태그 이름이 맞는 태그는 메모 전부, 아니면 제목이 맞는 메모만
	const filtered = useMemo(
		() =>
			entries
				.map((entry) => {
					const tagHit = entry.tag.label.toLowerCase().includes(q);
					return {
						tag: entry.tag,
						memos: !q || tagHit ? entry.memos : entry.memos.filter((memo) => memo.title.toLowerCase().includes(q)),
					};
				})
				.filter((entry) => entry.memos.length > 0),
		[entries, q],
	);

	const matched = useMemo(() => new Set(filtered.map((entry) => entry.tag.slug)), [filtered]);
	const seeAlso = useMemo(() => seeAlsoMap(entries), [entries]);

	const shelfTags = useMemo<ShelfTag[]>(
		() =>
			[...entries]
				.sort(
					(a, b) =>
						compareGroup(groupKeyOf(a.tag.label), groupKeyOf(b.tag.label)) ||
						a.tag.label.localeCompare(b.tag.label, "ko"),
				)
				.map((entry) => ({ slug: entry.tag.slug, label: entry.tag.label, count: entry.memos.length })),
		[entries],
	);

	const groups = useMemo(() => {
		const map = new Map<string, Group>();
		const shown = new Map(filtered.map((entry) => [entry.tag.slug, entry]));
		for (const entry of filtered) {
			// 지금 보이는 낱말 중 이 낱말에 통째로 들어 있는 것은 메모를 빼고 "→ 보라"로 남긴다
			const see = (seeAlso.get(entry.tag.slug) ?? []).flatMap((inner) => shown.get(inner.tag.slug) ?? []);
			const hidden = new Set(see.flatMap((inner) => inner.memos.map((memo) => memo.slug)));
			const { key, rank } = groupKeyOf(entry.tag.label);
			const group = map.get(key) ?? { key, rank, entries: [] };
			group.entries.push({ ...entry, memos: entry.memos.filter((memo) => !hidden.has(memo.slug)), see });
			map.set(key, group);
		}
		const list = [...map.values()].sort(compareGroup);
		for (const group of list) group.entries.sort((a, b) => a.tag.label.localeCompare(b.tag.label, "ko"));
		return list;
	}, [filtered, seeAlso]);

	const pickedEntry = picked ? filtered.find((entry) => entry.tag.slug === picked) : undefined;
	const pickedLabel = picked ? (entries.find((entry) => entry.tag.slug === picked)?.tag.label ?? picked) : null;
	const isEmpty = picked ? !pickedEntry : groups.length === 0;

	return (
		<div className="mx-auto w-full max-w-page px-6 pt-12 pb-24">
			<h1 className="mb-7 font-bold text-2xl leading-snug">{t("memos.title")}</h1>
			<div className="flex flex-wrap items-end justify-between gap-4 border-border border-b">
				<span aria-live="polite" className="pb-3 text-muted-foreground text-sm">
					{pickedLabel ? (
						<>
							<b className="font-semibold text-foreground">{pickedLabel}</b>
							<button
								type="button"
								onClick={() => setPicked(null)}
								className="ml-2.5 cursor-pointer rounded-sm underline decoration-[0.06em] underline-offset-[0.22em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
							>
								{t("memos.allTags")}
							</button>
						</>
					) : (
						t("memos.allTags")
					)}
				</span>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("memos.find")}
					aria-label={t("memos.find")}
					autoComplete="off"
					className="mb-2.5 w-full border-0 bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-48 sm:text-right"
				/>
			</div>

			<MemoShelf tags={shelfTags} picked={picked} matched={matched} onPick={setPicked} />

			<div className="pt-14">
				{memos.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("memos.empty")}</p>
				) : isEmpty ? (
					<p className="text-muted-foreground text-sm">{t("memos.noMatch")}</p>
				) : pickedEntry ? (
					<ul className="columns-1 gap-14 sm:columns-2">
						{pickedEntry.memos.map((memo) => (
							<MemoRow key={memo.slug} memo={memo} />
						))}
					</ul>
				) : (
					<div className="columns-1 gap-14 sm:columns-2">
						{groups.map((group) => (
							<section key={group.key} className="mb-10 break-inside-avoid">
								<h2 className="mb-3 border-border border-b pb-1.5 font-bold text-lg leading-snug">{group.key}</h2>
								{group.entries.map((entry) => (
									<div key={entry.tag.slug} className="pt-2 pb-1.5">
										<p className="mb-1 font-semibold text-[14.5px]">{entry.tag.label}</p>
										<ul>
											{entry.memos.map((memo) => (
												<MemoRow key={memo.slug} memo={memo} />
											))}
											{entry.see.map((inner) => (
												<li
													key={inner.tag.slug}
													className="flex items-baseline gap-4 py-1 pl-4 text-[14.5px] leading-relaxed"
												>
													<button
														type="button"
														onClick={() => setPicked(inner.tag.slug)}
														className="min-w-0 cursor-pointer rounded-sm text-left text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
													>
														→ {inner.tag.label}
													</button>
													<span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
														{inner.memos.length}
													</span>
												</li>
											))}
										</ul>
									</div>
								))}
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

const MemoListClient = ({ memos }: MemoListProps) => {
	const [tag, setTag] = useQueryState("tag", parseAsString);

	return <MemoListContent memos={memos} picked={tag} setPicked={(slug) => setTag(slug)} />;
};

export const MemoList = ({ memos }: MemoListProps) => {
	return (
		<Suspense fallback={<MemoListContent memos={memos} picked={null} setPicked={() => {}} />}>
			<MemoListClient memos={memos} />
		</Suspense>
	);
};
