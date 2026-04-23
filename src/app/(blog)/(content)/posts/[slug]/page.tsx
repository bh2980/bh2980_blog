import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost, listPostSlugs, listPosts } from "@/libs/contents/services/post";
import { PostDetailPageContent } from "./post-detail-page-content";

type BlogPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPost(slug);

	if (!post) {
		return {
			title: "Not Found",
			robots: { index: false, follow: true },
		};
	}

	const url = `/posts/${post.slug}`;

	return {
		title: post.title,
		description: post.excerpt,
		alternates: { canonical: url },
	};
}

export async function generateStaticParams() {
	const slugs = await listPostSlugs();

	return slugs.map((slug) => ({ slug }));
}

export default async function BlogPost({ params }: BlogPageProps) {
	const { slug } = await params;

	const post = await getPost(slug);
	const postList = await listPosts();

	if (!post) {
		return notFound();
	}

	return <PostDetailPageContent post={post} postList={postList.list} />;
}
