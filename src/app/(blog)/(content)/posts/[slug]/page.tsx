import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/mdx/callout";
import { renderMDX } from "@/components/mdx/mdx-content";
import { TableOfContents } from "@/components/table-of-contents.client";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost, getPostList } from "@/libs/contents/post";
import { cn } from "@/utils/cn";
import { Comments } from "./comments.client";

type BlogPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPost(slug);

	if (!post) {
		return {
			title: "Not Found",
			robots: { index: false, follow: true },
		};
	}

	const url = `/posts/${sanitizeSlug(slug)}`;

	return {
		title: post.title,
		description: post.excerpt,
		alternates: { canonical: url },
		openGraph: {
			title: post.title,
			description: post.excerpt,
			url,
		},
	};
}

// TODO : searchParams 제거
export default async function BlogPost({ params, searchParams }: BlogPageProps) {
	const { slug } = await params;
	const query = await searchParams;

	const post = await getPost(slug);
	const postList = await getPostList(query);

	const currentIndex = postList.list.findIndex((post) => sanitizeSlug(post.slug) === sanitizeSlug(slug));

	const nextPost = currentIndex + 1 < postList.total ? postList.list[currentIndex + 1] : null;
	const prevPost = currentIndex - 1 >= 0 ? postList.list[currentIndex - 1] : null;

	if (!post) {
		return notFound();
	}

	const source = await post.content();
	const { content, toc } = await renderMDX(source);

	return (
		<div className="mx-auto w-full px-6 py-8 xl:grid xl:grid-cols-[1fr_min(42rem,100%)_1fr] xl:gap-2">
			<div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 xl:col-start-2">
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
								href={{ pathname: "/posts", query }}
								className="flex items-center gap-1 text-slate-500 hover:underline dark:text-slate-400"
							>
								<ArrowLeft size={16} />
								<span>돌아가기</span>
							</Link>
						</nav>
						<div className="flex gap-2 pl-0.5 text-slate-500 text-xs dark:text-slate-400">
							<span>{post.category.name}</span>
							<span>·</span>
							<time dateTime={post.publishedDateTimeISO}>{post.publishedAt}</time>
						</div>
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
						<ul
							className={cn(
								"not-prose flex list-none flex-wrap items-center gap-2 text-slate-500 text-xs dark:text-slate-400",
								"[&_li]:rounded-full [&_li]:bg-slate-100 [&_li]:px-3 [&_li]:py-1.5 [&_li]:dark:bg-slate-800",
							)}
						>
							{post.tags?.map((tag) => (
								<li key={tag.slug}>{`#${tag.name}`}</li>
							))}
						</ul>
					</header>
					{post.isDeprecated ||
						(post.isStale && (
							<aside className="mt-4">
								{post.isDeprecated && (
									<Callout variant={"danger"}>
										<p>
											이 글은 더 이상 업데이트 되지 않습니다.
											{post.replacementPost && (
												<>
													{" "}
													최신 글은 <Link href={{ pathname: post.replacementPost }}>여기</Link>를 참조하세요
												</>
											)}
										</p>
									</Callout>
								)}
								{post.isStale && (
									<Callout variant="warning" description="이 글은 작성된 지 오래되어 최신 내용과 다를 수 있습니다." />
								)}
							</aside>
						))}
					{toc?.length !== 0 ? <TableOfContents toc={toc} className="mt-4 xl:hidden" /> : null}
					{content}
				</article>

				<Separator />

				<nav className="flex" aria-label="이전 다음 글">
					{prevPost && (
						<Link
							href={{ pathname: `/posts/${prevPost?.slug}`, query }}
							className="flex flex-col gap-2 hover:underline"
						>
							<span className="inline-flex items-center gap-1 text-sm">
								<ChevronLeft size={16} />
								이전 글
							</span>
							<span>{prevPost?.title}</span>
						</Link>
					)}

					{nextPost && (
						<Link
							href={{ pathname: `/posts/${nextPost?.slug}`, query }}
							className="ml-auto flex flex-col justify-end gap-2 hover:underline"
						>
							<span className="inline-flex items-center justify-end gap-1 text-sm">
								다음 글
								<ChevronRight size={16} />
							</span>
							<span>{nextPost?.title}</span>
						</Link>
					)}
				</nav>
				<Comments slug={slug} />
			</div>
			<aside className="hidden xl:block">
				{toc?.length !== 0 ? <TableOfContents toc={toc} className="sticky top-22 max-w-68" /> : null}
			</aside>
		</div>
	);
}
