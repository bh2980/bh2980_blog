import Link from "next/link";
import { AdminEditLinkClient } from "@/components/admin/admin-links.client";
import { Callout } from "@/components/mdx/callout";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import type { Post } from "@/libs/contents/types/legacy";
import { cn } from "@/utils/cn";
import { Comments } from "./comments.client";
import { PostBackLink } from "./post-back-link";
import { PostDetailNavigation } from "./post-detail-navigation";

type PostDetailPageContentProps = {
	post: Post;
	postList: Omit<Post, "content">[];
	currentSlug?: string;
	detailPathnamePrefix?: string;
	listPathname?: string;
};

export const PostDetailPageContent = async ({
	post,
	postList,
	currentSlug = post.slug,
	detailPathnamePrefix = "/posts",
	listPathname = "/posts",
}: PostDetailPageContentProps) => {
	const source = await post.content();
	const { content, toc } = await renderMDX(source);

	return (
		<div className="mx-auto w-full px-6 py-8 xl:grid xl:grid-cols-[1fr_min(42rem,100%)_1fr] xl:gap-2">
			<div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 xl:col-start-2">
				<article
					className={cn(
						"mx-auto w-full min-w-0 leading-loose",
						"prose prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-pre:my-0 prose-ul:my-10 prose-headings:scroll-mt-48 prose-img:rounded-md prose-h1:p-0",
						"dark:prose-invert",
					)}
				>
					<header className="flex flex-col items-start gap-5 border-slate-200">
						<PostBackLink pathname={listPathname} />
						<div className="flex w-full items-center gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							<span>{post.category.name}</span>
							<span>·</span>
							<time dateTime={post.publishedDateTimeISO}>{post.publishedAt}</time>
							<AdminEditLinkClient
								collection="post"
								slug={post.slug}
								className={cn(
									"not-prose ml-auto shrink-0 rounded border border-slate-300 px-2 py-0.5 font-medium text-[11px] text-slate-700 leading-5 transition hover:bg-slate-100 hover:text-slate-900",
									"dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
								)}
							/>
						</div>
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
						<ul
							className={cn(
								"not-prose flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{post.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.name}`}</li>
							))}
						</ul>
					</header>
					{(post.isDeprecated || post.isStale) && (
						<aside className="mt-8">
							{post.isDeprecated && (
								<Callout variant={"danger"}>
									<p>
										이 글은 더 이상 업데이트 되지 않습니다.
										{post.replacementPost && (
											<>
												{" "}
												최신 글은 <Link href={{ pathname: post.replacementPost }}>여기</Link>를 참조하세요
											</>
										)}
									</p>
								</Callout>
							)}
							{post.isStale && (
								<Callout variant="warning" description="이 글은 작성된 지 오래되어 최신 내용과 다를 수 있습니다." />
							)}
						</aside>
					)}
					{toc?.length > 0 ? <TableOfContents toc={toc} className="mt-4 xl:hidden" /> : null}
					{content}
				</article>

				<PostDetailNavigation currentSlug={currentSlug} items={postList} detailPathnamePrefix={detailPathnamePrefix} />
				<Comments slug={post.slug} />
			</div>
			<aside className="hidden xl:block">
				{toc?.length > 0 ? <TableOfContents toc={toc} className="sticky top-22 max-w-68" /> : null}
			</aside>
		</div>
	);
};
