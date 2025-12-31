import { notFound } from "next/navigation";
import MDXContent from "@/components/mdx-content";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost } from "@/libs/contents/post";
import { cn } from "@/utils/cn";

export default async function BlogPost({ params }: { params: Promise<{ slug: string; category: string }> }) {
	const { category, slug } = await params;

	const post = await getPost(sanitizeSlug(`${category}/${slug}`));

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12">
			<article className="prose dark:prose-invert max-w-none">
				<header className="flex flex-col gap-3 border-slate-200 border-b pb-6">
					<h1 className="!m-0 !p-0 font-bold text-3xl text-slate-900 dark:text-slate-100">{post.title}</h1>
					<div className={cn("flex items-center gap-3 text-sm")}>
						<span>{post.category.label}</span>
						<span>·</span>
						<time className="text-slate-500 dark:text-slate-400">{post.publishedDate}</time>
					</div>
				</header>
				<MDXContent source={content} />
				<div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
					{post.tags?.map((tag) => (
						<span
							key={tag.slug}
							className="rounded bg-slate-100 px-2 py-1 text-slate-600 text-sm dark:bg-slate-800 dark:text-slate-400"
						>
							#{tag.name}
						</span>
					))}
				</div>
			</article>
		</div>
	);
}
