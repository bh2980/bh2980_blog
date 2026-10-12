import { createPublicImageResolver } from "@monti-cms/core/render";
import { LanguageLinks } from "@/components/language-links";
import { renderMDX } from "@/components/mdx/mdx-content";
import { SeriesBar, SeriesPager } from "@/components/series-nav";
import { Sidenotes } from "@/components/sidenotes.client";
import { TableOfContents } from "@/components/table-of-contents.client";
import type { SeriesPlace } from "@/libs/contents/services/series";
import type { Memo } from "@/libs/contents/types/contents";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { cn } from "@/utils/cn";
import { formatPublishedAt } from "@/utils/format-published-at";

type MemoDetailPageContentProps = {
	memo: Memo;
	/** 이 메모가 든 모음집들. */
	seriesPlaces?: readonly SeriesPlace[];
	/** 공개 화면의 언어(v2 B4). */
	locale?: Locale;
	languageLinks?: readonly { locale: Locale; href: string }[];
	resolveHref?: (href: string) => string;
};

export const MemoDetailPageContent = async ({
	memo,
	seriesPlaces = [],
	locale = DEFAULT_LOCALE,
	languageLinks = [],
	resolveHref,
}: MemoDetailPageContentProps) => {
	const imageResolver = await createPublicImageResolver(memo.contentMdx);
	const { content, toc } = await renderMDX(memo.contentMdx, { imageResolver, locale, resolveHref });

	// 각주가 있으면 옆주가 오른쪽 여백을 쓰므로 목차는 왼쪽 여백으로 옮긴다.
	const hasFootnotes = /^\[\^[^\]]+\]:/m.test(memo.contentMdx);

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
						{memo.status === "published" && (
							<div className="text-muted-foreground text-sm">
								<time dateTime={memo.publishedAt}>{formatPublishedAt(memo.publishedAt, locale)}</time>
							</div>
						)}
						<h1 className="font-bold text-[clamp(1.75rem,4.6vw,2.5rem)] leading-[1.35]">{memo.title}</h1>
						{memo.tags?.length > 0 ? (
							<ul className="flex list-none flex-wrap items-center gap-x-3 text-muted-foreground text-sm">
								{memo.tags.map((tag) => (
									<li key={tag.slug}>{`#${tag.label}`}</li>
								))}
							</ul>
						) : null}
						<LanguageLinks current={locale} links={languageLinks} />
					</header>
					{toc?.length > 0 ? <TableOfContents toc={toc} className="mt-4 xl:hidden" /> : null}
					{content}
				</article>
				<Sidenotes />

				{seriesPlaces.map((place) => (
					<SeriesPager key={place.series.slug} place={place} locale={locale} />
				))}
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
