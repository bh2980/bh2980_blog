"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ListResult, Post, PostCategoryListMeta, PostCategoryWithCount } from "@/libs/contents/types";
import { cn } from "@/utils/cn";

export const PostList = ({
	categories,
	posts,
}: {
	categories: ListResult<PostCategoryWithCount, PostCategoryListMeta>;
	posts: ListResult<Omit<Post, "content">>;
}) => {
	const [category, setCategory] = useQueryState("category", { defaultValue: "all" });
	const postList = category === "all" ? posts.list : posts.list.filter((post) => post.category.value === category);

	return (
		<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-6">
				<h1 className="mb-4 font-bold text-3xl text-slate-900 dark:text-slate-100">블로그</h1>
				<p className="mb-6 text-slate-600 dark:text-slate-300">개발하면서 배운 것들과 경험을 기록합니다.</p>

				<div className="mb-6 flex flex-wrap gap-2">
					<Button
						onClick={() => setCategory("all")}
						className={cn(
							category === "all" && "!bg-slate-400/20 dark:!bg-slate-100/15 border-slate-400 dark:border-slate-100/30",
							"flex items-center justify-center rounded-full border bg-slate-50 px-3 py-1.5 font-medium text-slate-700 text-sm dark:bg-slate-800 dark:text-slate-300",
							"hover:bg-slate-400/20 dark:hover:bg-slate-100/15",
						)}
					>
						{category === "all" && (
							<span className="inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
						)}
						<span className="inline-block">전체 ({categories.meta?.totalPostCount})</span>
					</Button>
					{categories.list.map((categoryIem) => (
						<Button
							key={categoryIem.value}
							onClick={() => setCategory(categoryIem.value)}
							className={cn(
								category === categoryIem.value &&
									"!bg-slate-400/20 dark:!bg-slate-100/15 border-slate-400 dark:border-slate-100/30",
								"flex items-center justify-center rounded-full border bg-slate-50 px-3 py-1.5 font-medium text-slate-700 text-sm dark:bg-slate-800 dark:text-slate-300",
								"hover:bg-slate-400/20 dark:hover:bg-slate-100/15",
							)}
						>
							{category === categoryIem.value && (
								<span className="inline-block h-2 w-2 rounded-full bg-slate-900 dark:bg-slate-300" />
							)}
							<span className="inline-block">
								{categoryIem.label} ({categoryIem.count})
							</span>
						</Button>
					))}
				</div>
			</div>

			{postList.length === 0 ? (
				<div className="py-12 text-center">
					<p className="text-lg text-slate-500 dark:text-slate-400">아직 작성된 게시글이 없습니다.</p>
				</div>
			) : (
				<ul className="flex flex-col gap-1">
					{postList.map((post, index) => (
						<li key={post.slug}>
							{index !== 0 && <Separator />}
							<Link
								key={post.slug}
								href={`/posts/${post.slug}`}
								className="block rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<article className="flex h-full flex-col gap-3 rounded-lg p-4">
									<span className="flex gap-2 text-slate-500 text-xs dark:text-slate-400">
										<span>{post.category.label}</span>
										<span>·</span>
										<time>{post.publishedDate}</time>
									</span>
									<h2 className="line-clamp-1 font-semibold text-xl dark:text-slate-300">{post.title}</h2>
									<p className="line-clamp-2 text-slate-500 text-sm dark:text-slate-400">{post.excerpt}</p>
								</article>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
