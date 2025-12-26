import Link from "next/link";
import { notFound } from "next/navigation";
import MDXContent from "@/components/mdx-content";
import { reader } from "@/keystatic/libs/reader";

interface MemoPostProps {
	params: Promise<{ slug: string }>;
}

export default async function MemoPost({ params }: MemoPostProps) {
	const { slug } = await params;
	const r = await reader();

	const rawMemo = await r.collections.memo.read(slug);

	if (!rawMemo) {
		notFound();
	}

	const memo = {
		...rawMemo,
		publishedDate: new Date(rawMemo?.publishedDate).toLocaleString("ko-KR", {
			year: "numeric",
			month: "long",
			day: "numeric",
		}),
	};

	const content = await memo.content();

	return (
		<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			{/* 뒤로 가기 링크 */}
			<div className="mb-8">
				<Link href="/memos" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
					<svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
					메모장으로 돌아가기
				</Link>
			</div>

			<article className="prose prose-lg max-w-none">
				{/* 메모 헤더 */}
				<header className="mb-12 pb-8 border-b border-gray-200">
					<div className="flex items-center gap-3 mb-4">
						<span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
							{memo.category}
						</span>
						<time className="text-gray-500">{memo.publishedDate}</time>
					</div>

					<h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-100">{memo.title}</h1>

					<div className="flex flex-wrap gap-2">
						{memo.tags?.map((tag) => (
							<span
								key={tag}
								className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
							>
								#{tag}
							</span>
						))}
					</div>
				</header>
				<MDXContent source={content} />
			</article>
		</div>
	);
}
