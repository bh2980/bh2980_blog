import { notFound } from "next/navigation";
import { Callout } from "@/components/callout";
import MDXContent from "@/components/mdx-content";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPost } from "@/libs/contents/post";
import { BackButton } from "../../back-button";

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const post = await getPost(sanitizeSlug(slug));

	if (!post) {
		return notFound();
	}

	const content = await post.content();

	return (
		<article className="prose dark:prose-invert mx-auto prose-img:mx-auto prose-ol:my-10 prose-ul:my-10 prose-img:rounded-md pt-8 pb-24 leading-loose">
			<header className="flex flex-col items-start gap-5 border-slate-200">
				<BackButton className="mb-4" />
				<div className="flex gap-2 pl-0.5 text-slate-500 text-xs leading-1 dark:text-slate-400">
					<span>{post.category.label}</span>
					<span>·</span>
					<time>{post.publishedDate}</time>
				</div>
				<div className="flex flex-col gap-4">
					<h1 className="!m-0 !p-0 font-bold text-4xl text-slate-900 dark:text-slate-100">{post.title}</h1>

					<div className="flex flex-wrap items-center gap-1 text-slate-500 text-xs dark:text-slate-400">
						{post.tags?.map((tag) => (
							<span key={tag.slug} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
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
								최신 글은 <a href={post.replacementPost}>여기</a>를 참조하세요
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
	);
}
