import { createPublicImageResolver } from "@monti-cms/core/render";
import { differenceInYears } from "date-fns";
import { LanguageLinks } from "@/components/language-links";
import { Callout } from "@/components/mdx/callout";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import { entryPath } from "@/libs/contents/entry-path";
import type { Post } from "@/libs/contents/types/contents";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
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
	/** 공개 화면의 언어(v2 B4). 고정 문구·날짜 형식·본문 내부 링크를 이 언어에 맞춘다. */
	locale?: Locale;
	/** 공개된 다른 언어 번역본(언어 전환). */
	languageLinks?: readonly { locale: Locale; href: string }[];
	/** 본문 내부 링크를 이 언어 주소로 바꾼다. */
	resolveHref?: (href: string) => string;
};

export const PostDetailPageContent = async ({
	post,
	postList,
	currentSlug = post.slug,
	detailPathnamePrefix = "/posts",
	listPathname = "/posts",
	locale = DEFAULT_LOCALE,
	languageLinks = [],
	resolveHref,
}: PostDetailPageContentProps) => {
	const t = translator(locale);
	const imageResolver = await createPublicImageResolver(post.contentMdx);
	const { content, toc } = await renderMDX(post.contentMdx, { imageResolver, locale, resolveHref });
	const replacement = post.deprecation?.replacement;
	// 대체 글은 같은 언어 번역본이 없으면 원문 언어 주소로 안내한다.
	const replacementHref = replacement
		? !replacement.locale || replacement.locale === locale
			? `${detailPathnamePrefix}/${replacement.slug}`
			: entryPath(replacement.locale, "post", replacement.slug)
		: null;

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
						<PostBackLink pathname={listPathname} locale={locale} />
						<div className="flex w-full items-center gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							<span>{post.category.label}</span>
							{post.status === "published" && (
								<>
									<span>·</span>
									<time dateTime={post.publishedAt}>{formatPublishedAt(post.publishedAt, locale)}</time>
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
						<LanguageLinks current={locale} links={languageLinks} />
					</header>
					{post.deprecation && (
						<aside className="mt-8">
							<Callout variant="warning" title={t("post.deprecatedTitle")}>
								{replacement && replacementHref ? (
									<p>
										{t("post.deprecatedBefore")}
										<a href={replacementHref} hrefLang={replacement.locale}>
											{replacement.title}
										</a>
										{t("post.deprecatedAfter")}
									</p>
								) : (
									<p>{t("post.deprecatedNoReplacement")}</p>
								)}
							</Callout>
						</aside>
					)}
					{!post.deprecation && isStalePost(post) && (
						<aside className="mt-8">
							<Callout variant="warning">{t("post.stale")}</Callout>
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
