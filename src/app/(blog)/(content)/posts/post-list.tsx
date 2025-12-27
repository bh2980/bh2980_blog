import Link from "next/link";
import type { ListResult, PostCategorySummary, PostSummary } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const PostList = ({
	currentCategory,
	categoryList,
	postList,
}: {
	currentCategory?: string;
	categoryList: ListResult<PostCategorySummary>;
	postList: ListResult<PostSummary>;
}) => {
	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">블로그</h1>
				<p className="mb-8 text-gray-600 text-lg dark:text-gray-300">개발하면서 배운 것들과 경험을 기록합니다.</p>

				<div className="mb-8 flex flex-wrap gap-2">
					<Link
						href={"/posts"}
						className={cn(
							!currentCategory && "!bg-slate-400/25 dark:!bg-slate-100/25",
							"rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
						)}
					>
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						<span className="inline-block">전체 ({categoryList.total})</span>
					</Link>
					{categoryList.list.map((category) => (
						<Link
							href={`/posts/${category.slug}`}
							key={category.slug}
							className={cn(
								currentCategory === category.slug && "!bg-[var(--cat-color)]/20",
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

			{postList.total === 0 ? (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 게시글이 없습니다.</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{postList.list.map((post) => (
						<Link key={post.slug} href={`/posts/${post.slug}`} className="block">
							<article className="flex h-full items-center gap-4 rounded-lg bg-white p-4 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
								<time className="w-16 text-end text-gray-500 text-xs dark:text-gray-400">{post.publishedDate}</time>
								<span className="h-2 w-2 rounded-full" style={{ backgroundColor: `${post.category.color}` }} />
								<h2 className="line-clamp-2 font-semibold text-gray-900 dark:text-gray-100">{post.title}</h2>
							</article>
						</Link>
					))}
				</div>
			)}
		</div>
	);
};
