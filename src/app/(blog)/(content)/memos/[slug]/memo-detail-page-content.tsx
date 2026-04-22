import { AdminEditLinkClient } from "@/components/admin/admin-links.client";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import type { Memo } from "@/libs/contents/types/legacy";
import { cn } from "@/utils/cn";
import { MemoBackLink } from "./memo-back-link";

type MemoDetailPageContentProps = {
	memo: Memo;
	listPathname?: string;
};

export const MemoDetailPageContent = async ({ memo, listPathname = "/memos" }: MemoDetailPageContentProps) => {
	const source = await memo.content();
	const { content, toc } = await renderMDX(source);

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
						<MemoBackLink pathname={listPathname} />
						<div className="flex w-full items-center gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
							<AdminEditLinkClient
								collection="memo"
								slug={memo.slug}
								className={cn(
									"not-prose ml-auto shrink-0 rounded border border-slate-300 px-2 py-0.5 font-medium text-[11px] text-slate-700 leading-5 transition hover:bg-slate-100 hover:text-slate-900",
									"dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
								)}
							/>
						</div>
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{memo.title}</h1>
						<ul
							className={cn(
								"not-prose flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{memo.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.name}`}</li>
							))}
						</ul>
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
