import Link from "next/link";
import { reader } from "@/keystatic/libs/reader";
import { getMemoList } from "@/root/src/libs/contents/memo";

export default async function MemoPage() {
	const r = await reader();

	const allMemoCategories = await r.collections.memoCategory.all();

	const categoryMap = new Map(
		allMemoCategories.map((category) => [category.slug, { ...category.entry, slug: category.slug }]),
	);
	const categoryList = Array.from(categoryMap, (v) => v[1]);

	const memoList = await getMemoList();

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">메모장 📝</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">
					알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
				</p>

				{/* 카테고리 필터 탭 */}
				<div className="mb-8 flex flex-wrap gap-2">
					<div className="flex items-center justify-center rounded-full bg-gray-100 px-4 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300">
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						<span className="inline-block">전체</span>
					</div>
					{categoryList.map((category) => (
						<div
							key={category.slug}
							className="rounded-full bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300"
						>
							<span
								className="mr-2 inline-block h-2 w-2 rounded-full"
								style={{ backgroundColor: `${category.color}` }}
							/>
							<span className="inline-block">{category.name}</span>
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				{memoList.map((memo) => (
					<Link key={memo.slug} href={`/memos/${memo.slug}`} className="block">
						<article className="flex h-full gap-4 rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
							<span className="h-1 w-1 rounded-full" style={{ backgroundColor: `${memo.category.color}` }} />
							<div className="flex flex-col gap-1">
								<time className="text-gray-500 text-xs dark:text-gray-400">{memo.publishedDate}</time>
								<h2 className="mb-2 line-clamp-2 font-semibold text-gray-900 dark:text-gray-100">{memo.title}</h2>
							</div>
						</article>
					</Link>
				))}
			</div>

			{memoList.length === 0 && (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 메모가 없습니다.</p>
				</div>
			)}
		</div>
	);
}
