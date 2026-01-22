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
		<div className="mx-auto grid grid-cols-[1fr_min(42rem,100%)_1fr] gap-2 px-4 py-12 sm:px-6 lg:px-8">
			<div className="col-start-2 mx-auto flex flex-col gap-8">
				<nav aria-label="리스트로 돌아가기">
					<Link
						href={{ pathname: "/memos", query }}
						className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
					>
						<ArrowLeft size={14} />
						<span>돌아가기</span>
					</Link>
				</nav>
				<article className="prose dark:prose-invert prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 prose-headings:scroll-mt-32 prose-img:rounded-md prose-h1:p-0 leading-loose">
					<header className="flex flex-col items-start gap-5 border-slate-200">
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{memo.title}</h1>
						<div className="flex gap-2 pl-0.5 text-slate-500 text-xs leading-1 dark:text-slate-400">
							<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
						</div>
						<ul
							className={cn(
								"!m-0 !p-0 flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{memo.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.name}`}</li>
							))}
						</ul>
					</header>
					{content}
				</article>
			</div>
			<aside>
				{toc?.length && (
					<div className="sticky top-32 flex min-w-48 max-w-64 flex-col gap-6">{<TableOfContents toc={toc} />}</div>
				)}
			</aside>
		</div>
	);
}
