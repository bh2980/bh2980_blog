import Link from "next/link";
import type { ListResult, MemoCategorySummary, MemoSummary } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const MemoList = async ({
	currentCategory,
	categoryList,
	memoList,
}: {
	currentCategory?: string;
	categoryList: ListResult<MemoCategorySummary>;
	memoList: ListResult<MemoSummary>;
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
							!currentCategory && "!bg-slate-400/25 border-slate-400 dark:border-slate-100/30 dark:!bg-slate-100/20",
							"rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
						)}
					>
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						<span className="inline-block">전체 ({categoryList.total})</span>
					</Link>
					{categoryList.list.map((category) => (
						<Link
							href={`/memos/${category.slug}`}
							key={category.slug}
							className={cn(
								currentCategory === category.slug &&
									"!bg-[var(--cat-color)]/20 !border-[var(--cat-color)]/50 dark:!border-[var(--cat-color)]/40",
								"flex items-center justify-center rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
							)}
							style={{ "--cat-color": category.color } as React.CSSProperties}
						>
							<span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
							<span className="inline-block">
								{category.name} ({category.count})
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
								<span className="h-2 w-2 rounded-full" style={{ backgroundColor: `${memo.category.color}` }} />
								<h2 className="line-clamp-2 font-semibold dark:text-gray-300">{memo.title}</h2>
							</article>
						</Link>
					))}
				</div>
			)}
		</div>
	);
};
