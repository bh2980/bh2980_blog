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
		<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<div className="mb-12">
				<h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">시리즈 📚</h1>
				<p className="text-lg text-gray-600 dark:text-gray-300">연관된 주제별로 정리된 게시글 모음입니다.</p>
			</div>

			<div className="space-y-8">
				{seriesList.map((series) => {
					return (
						<section
							key={series.slug}
							id={series.slug}
							className="bg-gray-50 rounded-lg p-8 border border-gray-200 dark:bg-gray-900 dark:border-gray-800"
						>
							{/* 시리즈 헤더 */}
							<header className="mb-4 pb-4 border-b flex flex-col gap-3 border-gray-200 dark:border-gray-800">
								<div className="flex items-center justify-between">
									<span className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full font-medium dark:bg-indigo-900/30 dark:text-indigo-400">
										시리즈
									</span>
									<div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
										<svg
											className="mr-2 w-4 h-4"
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
									<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{series.title}</h2>
									<p className="text-sm text-gray-700 leading-relaxed dark:text-gray-300">{series.description}</p>
								</div>
							</header>

							{/* 게시글 목록 - 제목만 */}
							<div className="space-y-3">
								{series.posts.map((post, index) => (
									<div
										key={post.slug}
										className="flex items-center gap-4 py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-600"
									>
										<div className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
											{index + 1}
										</div>

										<div className="flex-1">
											<Link
												href={`/posts/${post.slug}`}
												className="text-gray-900 hover:text-indigo-600 font-medium transition-colors dark:text-gray-100 dark:hover:text-indigo-500"
											>
												{post.title}
											</Link>
										</div>

										<time className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
											{new Date(post.publishedDate).toLocaleDateString("ko-KR", {
												month: "short",
												day: "numeric",
											})}
										</time>
									</div>
								))}

								{series.posts.length === 0 && (
									<div className="text-center py-8">
										<p className="text-gray-500 dark:text-gray-400">이 시리즈에는 아직 게시글이 없습니다.</p>
									</div>
								)}
							</div>
						</section>
					);
				})}
			</div>

			{seriesList.length === 0 && (
				<div className="text-center py-12">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 시리즈이 없습니다.</p>
				</div>
			)}
		</div>
	);
}
