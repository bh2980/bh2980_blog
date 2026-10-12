import { createPublicImageResolver } from "@monti-cms/core/render";
import { differenceInYears } from "date-fns";
import { LanguageLinks } from "@/components/language-links";
import { Callout } from "@/components/mdx/callout";
import { renderMDX } from "@/components/mdx/mdx-content";
import { SeriesBar, SeriesPager } from "@/components/series-nav";
import { Sidenotes } from "@/components/sidenotes.client";
import { TableOfContents } from "@/components/table-of-contents.client";
import { entryPath } from "@/libs/contents/entry-path";
import type { SeriesPlace } from "@/libs/contents/services/series";
import type { Post } from "@/libs/contents/types/contents";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { cn } from "@/utils/cn";
import { formatPublishedAt } from "@/utils/format-published-at";
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
	/** 이 글이 든 모음집들. 비어 있으면 블로그 전체 이전·다음을 보여 준다. */
	seriesPlaces?: readonly SeriesPlace[];
	currentSlug?: string;
	detailPathnamePrefix?: string;
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
	seriesPlaces = [],
	currentSlug = post.slug,
	detailPathnamePrefix = "/posts",
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

	// 각주가 있으면 옆주가 오른쪽 여백을 쓰므로 목차는 왼쪽 여백으로 옮긴다.
	const hasFootnotes = /^\[\^[^\]]+\]:/m.test(post.contentMdx);

	return (
		<div className="mx-auto w-full px-6 pb-16 xl:grid xl:grid-cols-[1fr_min(48rem,100%)_1fr]">
			<div className="relative mx-auto flex w-full min-w-0 max-w-reading flex-col gap-12 pt-14 xl:col-start-2">
				<article
					className={cn(
						"mx-auto w-full min-w-0",
						"prose prose-img:mx-auto prose-pre:my-0 prose-headings:scroll-mt-48 prose-img:rounded-sm",
					)}
				>
					{seriesPlaces.map((place) => (
						<SeriesBar key={place.series.slug} place={place} locale={locale} />
					))}
					<header className="not-prose mb-10 flex flex-col items-start gap-4">
						<div className="flex w-full flex-wrap items-center gap-x-2 text-muted-foreground text-sm">
							{post.status === "published" && (
								<>
									<time dateTime={post.publishedAt}>{formatPublishedAt(post.publishedAt, locale)}</time>
									<span aria-hidden>·</span>
								</>
							)}
							<span>{post.category.label}</span>
						</div>
						<h1 className="font-bold text-[clamp(1.75rem,4.6vw,2.5rem)] leading-[1.35]">{post.title}</h1>
						{post.tags?.length > 0 ? (
							<ul className="flex list-none flex-wrap items-center gap-x-3 text-muted-foreground text-sm">
								{post.tags.map((tag) => (
									<li key={tag.slug}>{`#${tag.label}`}</li>
								))}
							</ul>
						) : null}
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
				<Sidenotes />

				{seriesPlaces.length > 0 ? (
					seriesPlaces.map((place) => <SeriesPager key={place.series.slug} place={place} locale={locale} />)
				) : (
					<PostDetailNavigation
						currentSlug={currentSlug}
						items={postList}
						detailPathnamePrefix={detailPathnamePrefix}
					/>
				)}
			</div>
			<aside
				className={cn(
					"hidden pt-14 xl:block",
					hasFootnotes ? "xl:col-start-1 xl:row-start-1 xl:justify-self-end xl:pr-8" : "xl:pl-8",
				)}
			>
				{toc?.length > 0 ? <TableOfContents toc={toc} className="sticky top-22 max-w-68" /> : null}
			</aside>
		</div>
	);
};
