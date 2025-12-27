import Link from "next/link";
import { getPostCategoryList } from "@/root/src/libs/contents/category";
import { getPostList } from "@/root/src/libs/contents/post";

export default async function BlogPage() {
	const categoryList = await getPostCategoryList();
	const postList = await getPostList();

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div>
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">블로그</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">개발하면서 배운 것들과 경험을 기록합니다.</p>

				{/* 카테고리 필터 탭 */}
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

			<div className="space-y-4">
				{postList.map((post) => (
					<Link key={post.slug} href={`/posts/${post.slug}`} className="block">
						<article className="rounded-lg border border-gray-200 bg-white p-8 transition-all hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
							<div className="mb-4 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-400">
										{post.category.name}
									</span>
									<time className="text-gray-500 text-sm dark:text-gray-400">{post.publishedDate}</time>
								</div>
							</div>
							<h2 className="mb-4 font-bold text-2xl text-gray-900 dark:text-gray-100">{post.title}</h2>
						</article>
					</Link>
				))}
			</div>

			{postList.length === 0 && (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 게시글이 없습니다.</p>
				</div>
			)}
		</div>
	);
}
