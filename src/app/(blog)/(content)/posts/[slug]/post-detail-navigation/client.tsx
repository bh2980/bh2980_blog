"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getHrefWithCurrentQuery } from "@/components/query-preserving-back-link.client";
import type { Post } from "@/libs/contents/types/contents";
import { useTranslate } from "@/libs/i18n/use-locale";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Post[];
	detailPathnamePrefix?: string;
};

/** 모음집에 들지 않은 글의 이전·다음. 모음집 이동과 같은 한 줄 모양이다. */
export const PostDetailNavigationClient = ({
	currentSlug,
	items,
	detailPathnamePrefix = "/posts",
}: PostDetailNavigationProps) => {
	const searchParams = useSearchParams();
	const { t } = useTranslate();
	const category = searchParams.get("category");
	const filteredItems = category ? items.filter((item) => item.category.slug === category) : items;
	const currentIndex = filteredItems.findIndex((item) => item.slug === currentSlug);
	const prevPost = currentIndex > 0 ? filteredItems[currentIndex - 1] : null;
	const nextPost =
		currentIndex >= 0 && currentIndex + 1 < filteredItems.length ? filteredItems[currentIndex + 1] : null;

	if (!prevPost && !nextPost) return null;

	return (
		<nav aria-label={t("detail.pageNav")} className="grid grid-cols-2 items-baseline gap-x-6 border-t pt-6 text-sm">
			{prevPost ? (
				<Link
					href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${prevPost.slug}`, searchParams)}
					aria-label={`${t("detail.prev")}: ${prevPost.title}`}
					className="group flex min-w-0 gap-2 text-foreground"
				>
					<span aria-hidden className="text-muted-foreground">
						←
					</span>
					<span className="min-w-0 group-hover:underline">{prevPost.title}</span>
				</Link>
			) : (
				<span aria-hidden />
			)}
			{nextPost ? (
				<Link
					href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${nextPost.slug}`, searchParams)}
					aria-label={`${t("detail.next")}: ${nextPost.title}`}
					className="group flex min-w-0 justify-end gap-2 text-right text-foreground"
				>
					<span className="min-w-0 group-hover:underline">{nextPost.title}</span>
					<span aria-hidden className="text-muted-foreground">
						→
					</span>
				</Link>
			) : null}
		</nav>
	);
};
