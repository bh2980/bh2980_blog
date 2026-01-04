import { notFound } from "next/navigation";
import Footer from "@/components/footer";
import MDXContent from "@/components/mdx/mdx-content";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemo } from "@/libs/contents/memo";

export default async function MemoPost({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const memo = await getMemo(sanitizeSlug(slug));

	if (!memo) {
		return notFound();
	}

	const content = await memo.content();

	return (
		<>
			<article className="prose dark:prose-invert prose-h1:m-0 mx-auto prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 max-w-3xl flex-1 prose-img:rounded-md prose-h1:p-0 px-4 py-12 leading-loose sm:px-6 lg:px-8">
				<header className="flex flex-col items-start gap-5 border-slate-200">
					<div className="flex gap-2 pl-0.5 text-slate-500 text-xs leading-1 dark:text-slate-400">
						<span>{memo.category.name}</span>
						<span>·</span>
						<time dateTime={memo.publishedDateTimeISO}>{memo.publishedAt}</time>
					</div>
					<div className="flex flex-col gap-4">
						<h1 className="font-bold text-4xl text-slate-900 dark:text-slate-100">{memo.title}</h1>

						<ul className="!m-0 !p-0 flex list-none flex-wrap items-center gap-1 text-slate-500 text-xs dark:text-slate-400">
							{memo.tags?.map((tag) => (
								<li key={tag.slug} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
									{`#${tag.name}`}
								</li>
							))}
						</ul>
					</div>
					<Separator className="mt-3 w-full" />
				</header>
				<MDXContent source={content} />
			</article>
			<Footer />
		</>
	);
}
