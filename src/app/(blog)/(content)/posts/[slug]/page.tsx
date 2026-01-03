import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/callout";
import MDXContent from "@/components/mdx-content";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost, getPostList } from "@/libs/contents/post";

export default async function BlogPost({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ category: string }>;
}) {
	const { slug } = await params;
	const query = await searchParams;

	const post = await getPost(sanitizeSlug(slug));
	const postList = await getPostList(query);

	const currentIndex = postList.list.findIndex((post) => sanitizeSlug(post.slug) === sanitizeSlug(slug));

	const nextPost = currentIndex + 1 < postList.total ? postList.list[currentIndex + 1] : null;
	const prevPost = currentIndex - 1 >= 0 ? postList.list[currentIndex - 1] : null;

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
			<nav aria-label="리스트로 돌아가기">
				<Link
					href={{ pathname: "/posts", query }}
					className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
				>
					<ArrowLeft size={14} />
					<span>돌아가기</span>
				</Link>
			</nav>
			<article className="prose dark:prose-invert prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 prose-img:rounded-md prose-h1:p-0 leading-loose">
				<header className="flex flex-col items-start gap-5 border-slate-200">
					<div className="flex gap-2 pl-0.5 text-slate-500 text-xs leading-1 dark:text-slate-400">
						<span>{post.category.label}</span>
						<span>·</span>
						<time dateTime={post.publishedDateTimeISO}>{post.publishedAt}</time>
					</div>
					<div className="flex flex-col gap-4">
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
						<ul className="!m-0 !p-0 flex list-none flex-wrap items-center gap-1 text-slate-500 text-xs dark:text-slate-400">
							{post.tags?.map((tag) => (
								<li key={tag.slug} className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
									{`#${tag.name}`}
								</li>
							))}
						</ul>
					</div>
					<Separator className="mt-3 w-full" />
				</header>
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
				<MDXContent source={content} />
			</article>
			<Separator />
			<nav className="flex" aria-label="이전 다음 글">
				{prevPost && (
					<Link href={{ pathname: `/posts/${prevPost?.slug}`, query }} className="flex flex-col gap-2 hover:underline">
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
						className="ml-auto flex flex-col justify-end gap-21 hover:underline"
					>
						<span className="inline-flex items-center justify-end gap-1 text-sm">
							다음 글
							<ChevronRight size={16} />
						</span>
						<span>{nextPost?.title}</span>
					</Link>
				)}
			</nav>
		</div>
	);
}
