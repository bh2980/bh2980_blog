import Link from "next/link";
import { reader } from "@/keystatic/libs/reader";

export default async function SeriesPage() {
	const r = await reader();

	const [allPosts, allSeries] = await Promise.all([r.collections.post.all(), r.collections.series.all()]);

	type PostItem = (typeof allPosts)[0]["entry"] & { slug: string };

	const seriesPostMap = new Map(
		allSeries.map((series) => [series.slug, { ...series.entry, slug: series.slug, posts: [] as PostItem[] }]),
	);

	allPosts
		.sort((a, b) => new Date(a.entry.publishedDate).getTime() - new Date(b.entry.publishedDate).getTime())
		.forEach((rawPost) => {
			if (rawPost.entry.series) {
				const series = seriesPostMap.get(rawPost.entry.series);

				if (series) {
					const post = { ...rawPost.entry, slug: rawPost.slug };
					series.posts.push(post);
				}
			}
		});

	const seriesList = Array.from(seriesPostMap, (v) => v[1]);

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">시리즈 📚</h1>
				<p className="text-gray-600 text-lg dark:text-gray-300">연관된 주제별로 정리된 게시글 모음입니다.</p>
			</div>

			<div className="space-y-8">
				{seriesList.map((series) => {
					return (
						<section
							key={series.slug}
							id={series.slug}
							className="rounded-lg border border-gray-200 bg-gray-50 p-8 dark:border-gray-800 dark:bg-gray-900"
						>
							{/* 시리즈 헤더 */}
							<header className="mb-4 flex flex-col gap-3 border-gray-200 border-b pb-4 dark:border-gray-800">
								<div className="flex items-center justify-between">
									<span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700 text-sm dark:bg-indigo-900/30 dark:text-indigo-400">
										시리즈
									</span>
									<div className="flex items-center text-gray-600 text-sm dark:text-gray-400">
										<svg
											className="mr-2 h-4 w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
											/>
										</svg>
										총 {series.posts.length}개의 게시글
									</div>
								</div>

								<div className="flex flex-col gap-1">
									<h2 className="font-bold text-gray-900 text-xl dark:text-gray-100">{series.title}</h2>
									<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">{series.description}</p>
								</div>
							</header>

							{/* 게시글 목록 - 제목만 */}
							<div className="space-y-3">
								{series.posts.map((post, index) => (
									<div
										key={post.slug}
										className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-600"
									>
										<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
											{index + 1}
										</div>

										<div className="flex-1">
											<Link
												href={`/posts/${post.slug}`}
												className="font-medium text-gray-900 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-500"
											>
												{post.title}
											</Link>
										</div>

										<time className="flex-shrink-0 text-gray-500 text-xs dark:text-gray-400">
											{new Date(post.publishedDate).toLocaleDateString("ko-KR", {
												month: "short",
												day: "numeric",
											})}
										</time>
									</div>
								))}

								{series.posts.length === 0 && (
									<div className="py-8 text-center">
										<p className="text-gray-500 dark:text-gray-400">이 시리즈에는 아직 게시글이 없습니다.</p>
									</div>
								)}
							</div>
						</section>
					);
				})}
			</div>

			{seriesList.length === 0 && (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 시리즈이 없습니다.</p>
				</div>
			)}
		</div>
	);
}
