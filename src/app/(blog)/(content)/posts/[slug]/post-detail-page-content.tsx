import { differenceInYears } from "date-fns";
import { createPublicImageResolver } from "@/cms/mdx/public-image-resolver";
import { Callout } from "@/components/mdx/callout";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import type { Post } from "@/libs/contents/types/contents";
import { cn } from "@/utils/cn";
import { formatPublishedAt } from "@/utils/format-published-at";
import { PostBackLink } from "./post-back-link";
import { PostDetailNavigation } from "./post-detail-navigation";

const POST_STALE_THRESHOLD_YEARS = 2;

function isStalePost(post: Post) {
	return (
		post.status === "published" &&
		!post.isEvergreen &&
		differenceInYears(Date.now(), new Date(post.publishedAt)) >= POST_STALE_THRESHOLD_YEARS
	);
}

type PostDetailPageContentProps = {
	post: Post;
	postList: Post[];
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
	const imageResolver = await createPublicImageResolver(post.contentMdx);
	const { content, toc } = await renderMDX(post.contentMdx, { imageResolver });

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
							<span>{post.category.label}</span>
							{post.status === "published" && (
								<>
									<span>·</span>
									<time dateTime={post.publishedAt}>{formatPublishedAt(post.publishedAt)}</time>
								</>
							)}
						</div>
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
						<ul
							className={cn(
								"not-prose flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{post.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.label}`}</li>
							))}
						</ul>
					</header>
					{post.deprecation && (
						<aside className="mt-8">
							<Callout variant="warning" title="더 이상 관리하지 않는 글입니다">
								{post.deprecation.replacement ? (
									<p>
										최신 내용은{" "}
										<a href={`${detailPathnamePrefix}/${post.deprecation.replacement.slug}`}>
											{post.deprecation.replacement.title}
										</a>
										에서 확인하세요.
									</p>
								) : (
									<p>내용이 현재와 다를 수 있습니다.</p>
								)}
							</Callout>
						</aside>
					)}
					{!post.deprecation && isStalePost(post) && (
						<aside className="mt-8">
							<Callout variant="warning" description="이 글은 작성된 지 오래되어 최신 내용과 다를 수 있습니다." />
						</aside>
					)}
					{toc?.length > 0 ? <TableOfContents toc={toc} className="mt-4 xl:hidden" /> : null}
					{content}
				</article>

				<PostDetailNavigation currentSlug={currentSlug} items={postList} detailPathnamePrefix={detailPathnamePrefix} />
			</div>
			<aside className="hidden xl:block">
				{toc?.length > 0 ? <TableOfContents toc={toc} className="sticky top-22 max-w-68" /> : null}
			</aside>
		</div>
	);
};
