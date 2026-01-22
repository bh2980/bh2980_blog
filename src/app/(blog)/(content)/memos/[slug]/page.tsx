import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemo } from "@/libs/contents/memo";
import { cn } from "@/utils/cn";

export default async function MemoPost({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ tags: string }>;
}) {
	const { slug } = await params;
	const query = await searchParams;

	const memo = await getMemo(sanitizeSlug(slug));

	if (!memo) {
		return notFound();
	}

	const source = await memo.content();
	const { content, toc } = await renderMDX(source);

	return (
		<div className="mx-auto w-full px-6 py-8 xl:grid xl:grid-cols-[1fr_min(42rem,100%)_1fr] xl:gap-2">
			<div className="flex w-full min-w-0 flex-col gap-8 xl:col-start-2">
				<article
					className={cn(
						"mx-auto w-full min-w-0 leading-loose",
						"prose prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 prose-headings:scroll-mt-32 prose-img:rounded-md prose-h1:p-0",
						"dark:prose-invert",
					)}
				>
					<header className="flex flex-col items-start gap-5 border-slate-200">
						<nav aria-label="리스트로 돌아가기" className="hidden md:block">
							<Link
								href={{ pathname: "/memos", query }}
								className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
							>
								<ArrowLeft size={14} />
								<span>돌아가기</span>
							</Link>
						</nav>
						<div className="flex gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
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
					{toc?.length && <TableOfContents toc={toc} className="mt-4 xl:hidden" />}
					{content}
				</article>
			</div>
			<aside className="hidden xl:block">
				{toc?.length && <TableOfContents toc={toc} className="sticky top-28 max-w-68" />}
			</aside>
		</div>
	);
}
