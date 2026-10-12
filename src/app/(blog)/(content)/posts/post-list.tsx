"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import type { Category, ListResult, Post } from "@/libs/contents/types/contents";
import { localizePath } from "@/libs/i18n/locales";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";
import { formatPublishedAtShort } from "@/utils/format-published-at";

type PostListCategory = Category & {
	count: number;
};

type PostListProps = {
	categories: PostListCategory[];
	posts: ListResult<Post>;
};

type PostListContentProps = PostListProps & {
	category: string | null;
	setCategory?: (value: string | null) => void;
};

const PostListContent = ({ categories, posts, category, setCategory }: PostListContentProps) => {
	const { locale, t } = useTranslate();
	const postList = category ? posts.list.filter((post) => post.category.slug === category) : posts.list;

	const filterClass = (active: boolean) =>
		cn(
			"h-auto rounded-none bg-transparent px-0 py-0.5 font-normal text-sm shadow-none hover:bg-transparent",
			active
				? "text-foreground underline decoration-1 underline-offset-[0.4em]"
				: "text-muted-foreground hover:text-foreground",
		);

	return (
		<div className="mx-auto w-full max-w-page px-6 pt-14 pb-20">
			<div className="mb-10">
				<h1 className="mb-2 font-bold text-[1.6rem] leading-tight">{t("posts.title")}</h1>
				<p className="mb-7 text-muted-foreground">{t("posts.description")}</p>
				<div className="flex flex-wrap gap-x-5 gap-y-2">
					<Button onClick={() => setCategory?.(null)} aria-pressed={!category} className={filterClass(!category)}>
						{t("posts.all", { count: posts.total })}
					</Button>
					{categories.map((categoryItem) => (
						<Button
							key={categoryItem.slug}
							onClick={() => setCategory?.(categoryItem.slug)}
							aria-pressed={category === categoryItem.slug}
							className={filterClass(category === categoryItem.slug)}
						>
							{categoryItem.label} ({categoryItem.count})
						</Button>
					))}
				</div>
			</div>
			{postList.length === 0 ? (
				<p className="py-12 text-center text-muted-foreground">{t("posts.empty")}</p>
			) : (
				<ul className="flex flex-col border-b">
					{postList.map((post) => (
						<li key={post.slug} className="border-t">
							<Link
								href={{
									pathname: localizePath(locale, `/posts/${post.slug}`),
									query: category ? { category } : undefined,
								}}
								className="group block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
							>
								<article className="py-5">
									<div className="flex items-baseline justify-between gap-4">
										<h2 className="line-clamp-2 text-[1.2rem] leading-snug transition-colors group-hover:text-primary">
											{post.title}
										</h2>
										{post.status === "published" && (
											<time
												dateTime={post.publishedAt}
												className="shrink-0 whitespace-nowrap text-muted-foreground text-sm tabular-nums"
											>
												{formatPublishedAtShort(post.publishedAt)}
											</time>
										)}
									</div>
									{post.excerpt && <p className="mt-1.5 line-clamp-2 text-muted-foreground text-sm">{post.excerpt}</p>}
									<p className="mt-1.5 flex flex-wrap gap-x-2 text-muted-foreground text-xs">
										<span>{post.category.label}</span>
										{post.tags && post.tags.length > 0 && (
											<>
												<span aria-hidden>·</span>
												{post.tags.map((tag) => (
													<span key={tag.slug}>{`#${tag.label}`}</span>
												))}
											</>
										)}
									</p>
								</article>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const PostListClient = ({ categories, posts }: PostListProps) => {
	const [category, setCategory] = useQueryState<string | null>("category", { parse: (value) => value || null });

	return <PostListContent categories={categories} posts={posts} category={category} setCategory={setCategory} />;
};

export const PostList = ({ categories, posts }: PostListProps) => {
	return (
		<Suspense fallback={<PostListContent categories={categories} posts={posts} category={null} />}>
			<PostListClient categories={categories} posts={posts} />
		</Suspense>
	);
};
