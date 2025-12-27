import Link from "next/link";
import { notFound } from "next/navigation";
import MDXContent from "@/components/mdx-content";
import { getPost } from "@/root/src/libs/contents/post";

interface BlogPostProps {
	params: Promise<{ slug: Array<string> }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogPost({ params }: BlogPostProps) {
	const slug = (await params).slug.join("/");
	const post = await getPost(slug);

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
			{/* 뒤로 가기 링크 */}
			<div className="mb-8">
				<Link href="/posts" className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700">
					<svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
					뒤로 가기
				</Link>
			</div>

			<article className="prose prose-lg max-w-none">
				{/* 메모 헤더 */}
				<header className="mb-12 border-gray-200 border-b pb-8">
					<div className="mb-4 flex items-center gap-3">
						<span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800 text-sm dark:bg-blue-900/30 dark:text-blue-400">
							{post.category.name}
						</span>
						<time className="text-gray-500">{post.publishedDate}</time>
					</div>

					<h1 className="mb-6 font-bold text-3xl text-gray-900 dark:text-gray-100">{post.title}</h1>

					<div className="flex flex-wrap gap-2">
						{post.tags?.map((tag) => (
							<span
								key={tag.slug}
								className="rounded bg-gray-100 px-3 py-1 text-gray-600 text-sm dark:bg-gray-800 dark:text-gray-400"
							>
								#{tag.name}
							</span>
						))}
					</div>
				</header>
				<MDXContent source={content} />
			</article>
		</div>
	);
}
