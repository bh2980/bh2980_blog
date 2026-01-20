"use client";

import Link from "next/link";
import { parseAsNativeArrayOf, parseAsString, useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Separator } from "@/components/ui/separator";
import type { ListResult, Memo, Tag } from "@/libs/contents/types";

export const MemoList = ({ memos, tags }: { tags: ListResult<Tag>; memos: ListResult<Omit<Memo, "content">> }) => {
	const [tagFilter, setTagFilter] = useQueryState<string[]>("tags", parseAsNativeArrayOf(parseAsString));

	const memoList = memos.list.filter(
		(memo) => tagFilter?.every((tag) => memo.tags.find((memoTag) => memoTag.slug === tag)) ?? true,
	);

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-6">
				<h1 className="mb-4 font-bold text-3xl text-slate-900 dark:text-slate-100">메모</h1>
				<MultiSelect
					options={tags.list}
					onValueChange={setTagFilter}
					defaultValue={tagFilter}
					placeholder="태그 선택"
				/>
			</div>

			{memoList.length === 0 ? (
				<div className="py-12 text-center">
					<p className="text-lg text-slate-500 dark:text-slate-400">아직 작성된 메모가 없습니다.</p>
				</div>
			) : (
				<ul className="flex flex-col">
					{memoList.map((memo, index) => (
						<li key={memo.slug}>
							{index !== 0 && <Separator className="my-1" />}
							<Link
								href={{ pathname: `/memos/${memo.slug}`, query: { tags: tagFilter } }}
								className="block rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<article className="flex h-full flex-col gap-3 rounded-lg p-4">
									<span className="flex gap-2 text-slate-500 text-xs dark:text-slate-400">
										<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
									</span>
									<h2 className="line-clamp-1 font-semibold text-xl dark:text-slate-300">{memo.title}</h2>
									<ul className="flex flex-wrap gap-1">
										{memo.tags.map((tag) => (
											<li key={tag.slug}>
												<Badge variant={"secondary"}>{tag.name}</Badge>
											</li>
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
