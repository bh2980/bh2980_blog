import Link from "next/link";
import { reader } from "@/keystatic/libs/reader";

// TODO : 추후 memo와 중복 제거
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

const isDefined = <T,>(value: T | undefined | null): value is T => {
	return value !== undefined && value !== null;
};

export default async function BlogPage() {
	const r = await reader();
	const [allPosts, allPostCategories, allTags] = await Promise.all([
		r.collections.post.all(),
		r.collections.postCategory.all(),
		r.collections.tag.all(),
	]);

	const categoryMap = new Map(
		allPostCategories.map((category) => [category.slug, { ...category.entry, slug: category.slug }]),
	);
	const tagMap = new Map(allTags.map((tag) => [tag.slug, { name: tag.entry.name, slug: tag.slug }]));

	const postList = allPosts
		.sort((a, b) => new Date(b.entry.publishedDate).getTime() - new Date(a.entry.publishedDate).getTime())
		.map((post) => {
			const { entry, slug } = post;
			const category = categoryMap.get(entry.category);
			const tags = (entry.tags || [])
				.filter((tagSlug): tagSlug is string => !!tagSlug)
				.map((tagSlug) => tagMap.get(tagSlug))
				.filter(isDefined);

			const publishedDate = new Date(post.entry.publishedDate).toLocaleString("ko-KR", { dateStyle: "short" });
			return {
				slug,
				title: entry.title,
				content: entry.content,
				publishedDate,
				category,
				tags,
			};
		})
		.filter(
			(
				post,
			): post is Expand<
				Omit<typeof post, "category"> & {
					category: NonNullable<typeof post.category>;
				}
			> => isDefined(post.category),
		);

	const categoryList = Array.from(categoryMap, (v) => v[1]);

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div>
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">블로그</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">개발하면서 배운 것들과 경험을 기록합니다.</p>

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

							<div className="flex flex-wrap gap-2">
								{post.tags.map((tag) => (
									<span
										key={tag.slug}
										className="rounded bg-gray-100 px-3 py-1 text-gray-600 text-sm dark:bg-gray-800 dark:text-gray-400"
									>
										#{tag.name}
									</span>
								))}
							</div>
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
