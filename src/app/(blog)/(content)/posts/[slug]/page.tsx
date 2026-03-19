import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getAdminContext } from "@/libs/admin/context";
import { getPost, getPostList, getPostSlugs } from "@/libs/contents/post";
import { PostDetailPageContent } from "./post-detail-page-content";

type BlogPageProps = {
	params: Promise<{ slug: string }>;
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
	};
}

export async function generateStaticParams() {
	const slugs = await getPostSlugs();

	return slugs.map((slug) => ({ slug }));
}

export default async function BlogPost({ params }: BlogPageProps) {
	const { slug } = await params;

	const post = await getPost(slug);
	const postList = await getPostList();

	if (!post) {
		return notFound();
	}

	const { canManage, keystaticMode } = await getAdminContext();

	return (
		<PostDetailPageContent post={post} postList={postList.list} canManage={canManage} keystaticMode={keystaticMode} />
	);
}
