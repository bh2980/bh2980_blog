"use client";

import Link from "next/link";
import { parseAsNativeArrayOf, parseAsString, useQueryState } from "nuqs";
import { MultiSelect } from "@/components/ui/multi-select";
import { Separator } from "@/components/ui/separator";
import type { ListResult, Memo, Tag } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const MemoList = ({ memos, tags }: { tags: ListResult<Tag>; memos: ListResult<Omit<Memo, "content">> }) => {
	const [tagFilter, setTagFilter] = useQueryState<string[]>("tags", parseAsNativeArrayOf(parseAsString));

	const memoList = memos.list.filter(
		(memo) => tagFilter?.every((tag) => memo.tags.find((memoTag) => memoTag.slug === tag)) ?? true,
	);

	return (
		<div className="mx-auto w-full max-w-2xl px-6 py-8 xl:py-12">
			<div className="mb-6">
				<h1 className="mb-4 font-bold text-3xl text-slate-900 dark:text-slate-100">메모</h1>
				<p className="mb-6 text-slate-600 dark:text-slate-300">
					개발 중에 자주 쓰는 팁, 문제 해결 기록, 코드 스니펫을 모아둡니다.
				</p>
				<MultiSelect
					options={tags.list}
					onValueChange={setTagFilter}
					defaultValue={tagFilter}
					placeholder="태그 선택"
					hideSelectAll
				/>
			</div>

			{memoList.length === 0 ? (
				<div className="py-12 text-center">
					<p className="text-lg text-slate-500 dark:text-slate-400">아직 작성된 메모가 없습니다.</p>
				</div>
			) : (
				<ul className="flex flex-col">
					{memoList.map((memo) => (
						<li key={memo.slug} className="group">
							<Separator className="my-1 group-first:hidden" />
							<Link
								href={{ pathname: `/memos/${memo.slug}`, query: { tags: tagFilter } }}
								className="block rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<article className="flex h-full flex-col gap-1 rounded-lg p-4">
									<span className="flex gap-2 text-slate-500 text-xs dark:text-slate-400">
										<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
									</span>
									<h2 className="line-clamp-1 font-semibold text-xl dark:text-slate-300">{memo.title}</h2>
									<ul
										className={cn(
											"!m-0 !p-0 flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
											"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
										)}
									>
										{memo.tags?.map((tag) => (
											<li key={tag.slug}>{`#${tag.name}`}</li>
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
