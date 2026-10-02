import { createPublicImageResolver } from "@bh2980/cms/runtime";
import { LanguageLinks } from "@/components/language-links";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import type { Memo } from "@/libs/contents/types/contents";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { cn } from "@/utils/cn";
import { formatPublishedAt } from "@/utils/format-published-at";
import { MemoBackLink } from "./memo-back-link";

type MemoDetailPageContentProps = {
	memo: Memo;
	listPathname?: string;
	/** 공개 화면의 언어(v2 B4). */
	locale?: Locale;
	languageLinks?: readonly { locale: Locale; href: string }[];
	resolveHref?: (href: string) => string;
};

export const MemoDetailPageContent = async ({
	memo,
	listPathname = "/memos",
	locale = DEFAULT_LOCALE,
	languageLinks = [],
	resolveHref,
}: MemoDetailPageContentProps) => {
	const imageResolver = await createPublicImageResolver(memo.contentMdx);
	const { content, toc } = await renderMDX(memo.contentMdx, { imageResolver, locale, resolveHref });

	return (
		<div className="mx-auto w-full px-6 py-8 xl:grid xl:grid-cols-[1fr_min(42rem,100%)_1fr] xl:gap-2">
			<div className="flex w-full min-w-0 flex-col gap-8 xl:col-start-2">
				<article
					className={cn(
						"mx-auto w-full min-w-0 leading-loose",
						"prose prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-pre:my-0 prose-ul:my-10 prose-headings:scroll-mt-48 prose-img:rounded-md prose-h1:p-0",
						"dark:prose-invert",
					)}
				>
					<header className="flex flex-col items-start gap-5 border-slate-200">
						<MemoBackLink pathname={listPathname} locale={locale} />
						<div className="flex w-full items-center gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							{memo.status === "published" && (
								<time dateTime={memo.publishedAt}>{formatPublishedAt(memo.publishedAt, locale)}</time>
							)}
						</div>
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{memo.title}</h1>
						<ul
							className={cn(
								"not-prose flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{memo.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.label}`}</li>
							))}
						</ul>
						<LanguageLinks current={locale} links={languageLinks} />
					</header>
					{toc?.length > 0 ? <TableOfContents toc={toc} className="mt-4 xl:hidden" /> : null}
					{content}
				</article>
			</div>
			<aside className="hidden xl:block">
				{toc?.length > 0 ? <TableOfContents toc={toc} className="sticky top-22 max-w-68" /> : null}
			</aside>
		</div>
	);
};
