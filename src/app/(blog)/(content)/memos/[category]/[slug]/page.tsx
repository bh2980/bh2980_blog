import { notFound } from "next/navigation";
import MDXContent from "@/components/mdx-content";
import { getMemo } from "@/libs/contents/memo";
import { cn } from "@/utils/cn";

interface MemoPostProps {
	params: Promise<{ category: string; slug: string }>;
}

export default async function MemoPost({ params }: MemoPostProps) {
	const { category, slug } = await params;

	const memo = await getMemo(`${category}/${slug}`);

	if (!memo) {
		return notFound();
	}

	const content = await memo.content();

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-12">
			<article className="prose dark:prose-invert max-w-none">
				<header className="flex flex-col gap-3 border-gray-200 border-b pb-6">
					<h1 className="!m-0 !p-0 font-bold text-3xl text-gray-900 dark:text-gray-100">{memo.title}</h1>
					<div
						className={cn("flex items-center gap-3 text-sm")}
						style={{ "--cat-color": memo.category.color } as React.CSSProperties}
					>
						<span>
							<span className={cn("mr-2 inline-block h-2 w-2 rounded-full font-bold", "bg-[var(--cat-color)]")} />
							{memo.category.name}
						</span>
						<span>·</span>
						<time className="text-gray-500 dark:text-gray-400">{memo.publishedDate}</time>
					</div>
				</header>
				<MDXContent source={content} />
				<div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
					{memo.tags?.map((tag) => (
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
