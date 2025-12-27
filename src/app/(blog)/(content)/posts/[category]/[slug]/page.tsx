import { notFound } from "next/navigation";
import MDXContent from "@/components/mdx-content";
import { getPost } from "@/libs/contents/post";
import { cn } from "@/utils/cn";

export default async function BlogPost({ params }: { params: { slug: string; category: string } }) {
	const { category, slug } = params;

	const post = await getPost(`${category}/${slug}`);

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-12">
			<article className="prose dark:prose-invert max-w-none">
				<header className="flex flex-col gap-3 border-gray-200 border-b pb-6">
					<h1 className="!m-0 !p-0 font-bold text-3xl text-gray-900 dark:text-gray-100">{post.title}</h1>
					<div
						className={cn("flex items-center gap-3 text-sm")}
						style={{ "--cat-color": post.category.color } as React.CSSProperties}
					>
						<span>
							<span className={cn("mr-2 inline-block h-2 w-2 rounded-full font-bold", "bg-[var(--cat-color)]")} />
							{post.category.name}
						</span>
						<span>·</span>
						<time className="text-gray-500 dark:text-gray-400">{post.publishedDate}</time>
					</div>
				</header>
				<MDXContent source={content} />
				<div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
					{post.tags?.map((tag) => (
						<span
							key={tag.slug}
							className="rounded bg-gray-100 px-2 py-1 text-gray-600 text-sm dark:bg-gray-800 dark:text-gray-400"
						>
							#{tag.name}
						</span>
					))}
				</div>
			</article>
		</div>
	);
}
