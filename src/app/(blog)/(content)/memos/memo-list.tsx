"use client";

import Link from "next/link";
import { parseAsNativeArrayOf, parseAsString, useQueryState } from "nuqs";
import { Suspense } from "react";
import { MultiCombobox } from "@/components/multi-combobox";
import { Separator } from "@/components/ui/separator";
import type { ListResult, Memo, Tag } from "@/libs/contents/types/contents";
import { localizePath } from "@/libs/i18n/locales";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";
import { formatPublishedAt } from "@/utils/format-published-at";

type MemoListProps = {
	tags: ListResult<Tag>;
	memos: ListResult<Memo>;
};

type MemoListContentProps = MemoListProps & {
	tagFilter?: string[];
	setTagFilter?: (value: string[]) => void;
};

const MemoListContent = ({ memos, tags, tagFilter, setTagFilter }: MemoListContentProps) => {
	const { locale, t } = useTranslate();
	const memoList = memos.list.filter(
		(memo) => tagFilter?.every((tag) => memo.tags.find((memoTag) => memoTag.slug === tag)) ?? true,
	);

	return (
		<div className="mx-auto w-full max-w-2xl px-6 py-8 xl:py-12">
			<div className="mb-6">
				<h1 className="mb-4 font-bold text-3xl text-slate-900 dark:text-slate-100">{t("memos.title")}</h1>
				<p className="mb-6 text-slate-600 dark:text-slate-300">{t("memos.description")}</p>
				<MultiCombobox
					options={tags.list.map((tag) => ({ value: tag.slug, label: tag.label }))}
					value={tagFilter ?? []}
					onValueChange={setTagFilter ?? (() => {})}
					placeholder={t("memos.tagPlaceholder")}
					aria-label={t("memos.tagFilter")}
					emptyText={t("memos.tagEmpty")}
				/>
			</div>

			{memoList.length === 0 ? (
				<div className="py-12 text-center">
					<p className="text-lg text-slate-500 dark:text-slate-400">{t("memos.empty")}</p>
				</div>
			) : (
				<ul className="flex flex-col">
					{memoList.map((memo) => (
						<li key={memo.slug} className="group">
							<Separator className="my-1 group-first:hidden" />
							<Link
								href={{ pathname: localizePath(locale, `/memos/${memo.slug}`), query: { tags: tagFilter } }}
								className="block rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<article className="flex h-full flex-col gap-1 rounded-lg p-4">
									<span className="flex gap-2 text-slate-500 text-xs dark:text-slate-400">
										{memo.status === "published" && (
											<time dateTime={memo.publishedAt}>{formatPublishedAt(memo.publishedAt, locale)}</time>
										)}
									</span>
									<h2 className="line-clamp-1 font-semibold text-xl dark:text-slate-300">{memo.title}</h2>
									<ul
										className={cn(
											"!m-0 !p-0 flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
											"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
										)}
									>
										{memo.tags?.map((tag) => (
											<li key={tag.slug}>{`#${tag.label}`}</li>
										))}
									</ul>
								</article>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const MemoListClient = ({ memos, tags }: MemoListProps) => {
	const [tagFilter, setTagFilter] = useQueryState<string[]>("tags", parseAsNativeArrayOf(parseAsString));

	return <MemoListContent memos={memos} tags={tags} tagFilter={tagFilter ?? undefined} setTagFilter={setTagFilter} />;
};

export const MemoList = ({ memos, tags }: MemoListProps) => {
	return (
		<Suspense fallback={<MemoListContent memos={memos} tags={tags} />}>
			<MemoListClient memos={memos} tags={tags} />
		</Suspense>
	);
};
