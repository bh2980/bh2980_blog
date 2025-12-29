import Link from "next/link";
import type { ListResult, Memo, MemoCategoryListMeta, MemoCategoryWithCount } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const MemoList = async ({
	currentCategory,
	categoryList,
	memoList,
}: {
	currentCategory?: string;
	categoryList: ListResult<MemoCategoryWithCount, MemoCategoryListMeta>;
	memoList: ListResult<Memo>;
}) => {
	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">메모장 📝</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">
					알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
				</p>

				<div className="mb-8 flex flex-wrap gap-2">
					<Link
						href={"/memos"}
						className={cn(
							!currentCategory && "!bg-slate-400/25 dark:!bg-slate-100/20 border-slate-400 dark:border-slate-100/30",
							"rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
						)}
					>
						{!currentCategory && (
							<span className="mr-2 ml-0.5 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						)}
						<span className="inline-block">전체 ({memoList.total})</span>
					</Link>
					{categoryList.list.map((category) => (
						<Link
							href={`/memos/${category.value}`}
							key={category.value}
							className={cn(
								"flex items-center justify-center rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
								currentCategory === category.value &&
									"!bg-slate-400/25 dark:!bg-slate-100/20 border-slate-400 dark:border-slate-100/30",
							)}
						>
							{currentCategory === category.value && (
								<span className="mr-2 ml-0.5 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
							)}
							<span className="inline-block">
								{category.label} ({category.count})
							</span>
						</Link>
					))}
				</div>
			</div>

			{memoList.total === 0 ? (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 메모가 없습니다.</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{memoList.list.map((memo) => (
						<Link key={memo.slug} href={`/memos/${memo.slug}`} className="block">
							<article className="flex h-full items-center gap-4 rounded-lg p-4">
								<time className="w-16 text-end text-gray-500 text-xs dark:text-gray-300">{memo.publishedDate}</time>
								<h2 className="line-clamp-2 font-semibold dark:text-gray-300">{memo.title}</h2>
							</article>
						</Link>
					))}
				</div>
			)}
		</div>
	);
};
