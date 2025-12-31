import Link from "next/link";
import { Fragment } from "react/jsx-runtime";
import { Separator } from "@/components/ui/separator";
import type { ListResult, Post, PostCategoryListMeta, PostCategoryWithCount } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const PostList = ({
	currentCategory,
	categoryList,
	postList,
}: {
	currentCategory?: string;
	categoryList: ListResult<PostCategoryWithCount, PostCategoryListMeta>;
	postList: ListResult<Post>;
}) => {
	return (
		<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-6">
				<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-gray-100">블로그</h1>
				<p className="mb-6 text-gray-600 dark:text-gray-300">개발하면서 배운 것들과 경험을 기록합니다.</p>

				<div className="mb-6 flex flex-wrap gap-2">
					<Link
						href={"/posts"}
						className={cn(
							!currentCategory && "!bg-slate-400/25 dark:!bg-slate-100/20 border-slate-400 dark:border-slate-100/30",
							"rounded-full border bg-gray-50 px-3 py-1.5 font-medium text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300",
						)}
					>
						{!currentCategory && (
							<span className="mr-2 ml-0.5 inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						)}
						<span className="inline-block">전체 ({categoryList.meta?.totalPostCount})</span>
					</Link>
					{categoryList.list.map((category) => (
						<Link
							href={`/posts/${category.value}`}
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

			{postList.total === 0 ? (
				<div className="py-12 text-center">
					<p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 게시글이 없습니다.</p>
				</div>
			) : (
				<div className="flex flex-col gap-1">
					{postList.list.map((post, index) => (
						<Fragment key={post.slug}>
							{index !== 0 && <Separator />}
							<Link
								key={post.slug}
								href={`/posts/${post.slug}`}
								className="block rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
							>
								<article className="flex h-full flex-col gap-4 rounded-lg p-4">
									<span className="flex gap-2 text-gray-500 text-xs dark:text-gray-400">
										<span>{post.category.label}</span>
										<span>·</span>
										<time>{post.publishedDate}</time>
									</span>
									<h2 className="line-clamp-1 font-semibold text-xl dark:text-gray-300">{post.title}</h2>
									<p className="line-clamp-2">{post.excerpt}</p>
								</article>
							</Link>
						</Fragment>
					))}
				</div>
			)}
		</div>
	);
};
