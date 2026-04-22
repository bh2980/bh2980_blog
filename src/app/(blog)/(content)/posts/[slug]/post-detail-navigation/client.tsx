"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getHrefWithCurrentQuery } from "@/components/query-preserving-back-link.client";
import { Separator } from "@/components/ui/separator";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import type { Post } from "@/libs/contents/types/legacy";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Omit<Post, "content">[];
	detailPathnamePrefix?: string;
};

export const PostDetailNavigationClient = ({
	currentSlug,
	items,
	detailPathnamePrefix = "/posts",
}: PostDetailNavigationProps) => {
	const searchParams = useSearchParams();
	const category = searchParams.get("category");
	const filteredItems = category ? items.filter((item) => item.category.slug === category) : items;
	const currentIndex = filteredItems.findIndex((item) => sanitizeSlug(item.slug) === sanitizeSlug(currentSlug));
	const prevPost = currentIndex > 0 ? filteredItems[currentIndex - 1] : null;
	const nextPost =
		currentIndex >= 0 && currentIndex + 1 < filteredItems.length ? filteredItems[currentIndex + 1] : null;

	return (
		<>
			<Separator />
			<nav aria-label="상세 페이지 이동" className="flex flex-col gap-6">
				<div className="flex">
					{prevPost && (
						<Link
							href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${sanitizeSlug(prevPost.slug)}`, searchParams)}
							className="flex flex-col gap-2 hover:underline"
						>
							<span className="inline-flex items-center gap-1 text-sm">
								<ChevronLeft size={16} />
								이전 글
							</span>
							<span>{prevPost.title}</span>
						</Link>
					)}

					{nextPost && (
						<Link
							href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${sanitizeSlug(nextPost.slug)}`, searchParams)}
							className="ml-auto flex flex-col justify-end gap-2 hover:underline"
						>
							<span className="inline-flex items-center justify-end gap-1 text-sm">
								다음 글
								<ChevronRight size={16} />
							</span>
							<span>{nextPost.title}</span>
						</Link>
					)}
				</div>
			</nav>
		</>
	);
};
