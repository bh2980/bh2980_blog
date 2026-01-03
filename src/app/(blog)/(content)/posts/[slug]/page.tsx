import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/callout";
import MDXContent from "@/components/mdx-content";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost } from "@/libs/contents/post";

export default async function BlogPost({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ category: string }>;
}) {
	const { slug } = await params;
	const category = (await searchParams)?.category;

	const post = await getPost(sanitizeSlug(slug));

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
			<article className="prose dark:prose-invert prose-h1:m-0 prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 prose-img:rounded-md prose-h1:p-0 leading-loose">
				<header className="flex flex-col items-start gap-5 border-slate-200">
					<Link
						href={{ pathname: "/posts", query: { category } }}
						className={
							"m-0 inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
						}
					>
						<ArrowLeft />
						<span>돌아가기</span>
					</Link>
					<div className="flex gap-2 pl-0.5 text-slate-500 text-xs leading-1 dark:text-slate-400">
						<span>{post.category.label}</span>
						<span>·</span>
						<time>{post.publishedDate}</time>
					</div>
					<div className="flex flex-col gap-4">
						<h1 className="font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
						<div className="flex flex-wrap items-center gap-1 text-slate-500 text-xs dark:text-slate-400">
							{post.tags?.map((tag) => (
								<span key={tag.slug} className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
									{`#${tag.name}`}
								</span>
							))}
						</div>
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
			<div className="flex justify-between">
				<Link href="/posts" className="flex flex-col gap-2">
					<span className="inline-flex items-center gap-2 text-sm">
						<ChevronLeft size={16} />
						이전 글
					</span>
					<span>이전 글 제목입니다</span>
				</Link>

				<Link href="/posts" className="flex flex-col justify-end gap-2">
					<span className="inline-flex items-center justify-end gap-2 text-sm">
						다음 글
						<ChevronRight size={16} />
					</span>
					<span>다음 글 제목입니다</span>
				</Link>
			</div>
		</div>
	);
}
