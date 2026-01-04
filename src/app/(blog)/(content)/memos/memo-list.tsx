"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListResult, Memo, MemoCategoryListMeta, MemoCategoryWithCount } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const MemoList = ({
	categories,
	memos,
}: {
	categories: ListResult<MemoCategoryWithCount, MemoCategoryListMeta>;
	memos: ListResult<Omit<Memo, "content">>;
}) => {
	const [category, setCategory] = useQueryState("category", { defaultValue: "all" });
	const memoList = category === "all" ? memos.list : memos.list.filter((memo) => memo.category.slug === category);

	return (
		<aside className="flex min-h-0 flex-col gap-4 border-slate-200 p-4 md:border-r dark:border-slate-800">
			<Select defaultValue={category} onValueChange={(value) => setCategory(value)}>
				<SelectTrigger className="w-full shrink-0">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">전체 ({memos.total})</SelectItem>
					{categories.list.map((categoryItem) => (
						<SelectItem key={categoryItem.slug} value={categoryItem.slug}>
							{categoryItem.name} ({categoryItem.count})
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="flex-1 overflow-auto">
				{memoList.length === 0 ? (
					<div className="flex h-full items-center justify-center py-12 text-center">
						<p className="text-slate-500 text-sm dark:text-slate-400">아직 작성된 메모가 없습니다.</p>
					</div>
				) : (
					<ul className="z-50 flex h-full flex-col gap-1 overflow-auto text-sm">
						{memoList.map((memo) => (
							<li key={memo.slug} className={cn("rounded-md hover:bg-slate-100 dark:hover:bg-slate-800")}>
								<Link href={{ pathname: `/memos/${memo.slug}`, query: category ? { category } : undefined }}>
									<article className="flex h-full items-center gap-4 rounded-lg p-2">
										<h2 className="line-clamp-1 font-semibold dark:text-slate-300">{memo.title}</h2>
									</article>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
};
