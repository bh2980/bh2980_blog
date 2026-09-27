"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getHrefWithCurrentQuery } from "@/components/query-preserving-back-link.client";
import { Separator } from "@/components/ui/separator";
import type { Post } from "@/libs/contents/types/contents";
import { useTranslate } from "@/libs/i18n/use-locale";

type PostDetailNavigationProps = {
	currentSlug: string;
	items: Post[];
	detailPathnamePrefix?: string;
};

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

	return (
		<>
			<Separator />
			<nav aria-label={t("detail.pageNav")} className="flex flex-col gap-6">
				<div className="flex">
					{prevPost && (
						<Link
							href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${prevPost.slug}`, searchParams)}
							className="flex flex-col gap-2 hover:underline"
						>
							<span className="inline-flex items-center gap-1 text-sm">
								<ChevronLeft size={16} />
								{t("detail.prev")}
							</span>
							<span>{prevPost.title}</span>
						</Link>
					)}

					{nextPost && (
						<Link
							href={getHrefWithCurrentQuery(`${detailPathnamePrefix}/${nextPost.slug}`, searchParams)}
							className="ml-auto flex flex-col justify-end gap-2 hover:underline"
						>
							<span className="inline-flex items-center justify-end gap-1 text-sm">
								{t("detail.next")}
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
