import Link from "next/link";
import { getMemoCategoryList } from "@/libs/contents/category";
import { getMemoList } from "@/libs/contents/memo";

export default async function MemoPage() {
	const categoryList = await getMemoCategoryList();

	const memoList = await getMemoList();

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">메모장 📝</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">
					알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
				</p>

				<div className="mb-8 flex flex-wrap gap-2">
					<div className="rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300">
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						<span className="inline-block">전체 ({categoryList.total})</span>
					</div>
					{categoryList.list.map((category) => (
						<div
							key={category.slug}
							className="flex items-center justify-center rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300"
						>
							<span
								className="mr-2 inline-block h-2 w-2 rounded-full"
								style={{ backgroundColor: `${category.color}` }}
							/>
							<span className="inline-block">
								{category.name} ({category.count})
							</span>
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				{memoList.list.map((memo) => (
					<Link key={memo.slug} href={`/memos/${memo.slug}`} className="block">
						<article className="flex h-full items-center gap-4 rounded-lg bg-white p-4 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
							<time className="w-14 text-end text-gray-500 text-xs dark:text-gray-400">{memo.publishedDate}</time>
							<span className="h-2 w-2 rounded-full" style={{ backgroundColor: `${memo.category.color}` }} />
							<h2 className="line-clamp-2 font-semibold text-gray-900 dark:text-gray-100">{memo.title}</h2>
						</article>
					</Link>
				))}
			</div>

			{memoList.total === 0 && (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 메모가 없습니다.</p>
				</div>
			)}
		</div>
	);
}
