import "server-only";

import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";
import type { PublishedMemo, PublishedPost, Series } from "../types/contents";

const contentRepository = getContentRepository();

/** 공개 화면에 보이는 모음집. 이 언어로 공개된 항목이 하나도 없는 모음집은 뺀다. */
export async function listSeries(locale: Locale = DEFAULT_LOCALE): Promise<Series[]> {
	const seriesList = await contentRepository.listSeries(locale);

	return seriesList.filter((series) => series.items.length > 0);
}

export async function getSeries(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Series | null> {
	return await contentRepository.getSeries(slug, locale);
}

type SeriesItem = PublishedPost | PublishedMemo;

/** 글·메모 하나가 든 모음집과 그 안의 자리. 앞·다음은 같은 모음집 안의 이웃이다. */
export type SeriesPlace = {
	series: Pick<Series, "slug" | "label" | "kind">;
	/** 1부터 센 순서 */
	index: number;
	total: number;
	prev: SeriesItem | null;
	next: SeriesItem | null;
};

const itemKey = (item: { slug: string; translationGroupId?: string }) => item.translationGroupId ?? item.slug;

/**
 * 이 글·메모가 든 모음집들. 한 항목이 여러 모음집에 들 수 있어 목록으로 돌려준다.
 * 번역 묶음 ID로 맞추므로 다른 언어 번역본에서도 같은 모음집을 찾는다.
 */
export async function findSeriesPlaces(
	collection: "post" | "memo",
	entry: { slug: string; translationGroupId?: string },
	locale: Locale = DEFAULT_LOCALE,
): Promise<SeriesPlace[]> {
	const key = itemKey(entry);
	const seriesList = await listSeries(locale);

	return seriesList.flatMap((series): SeriesPlace[] => {
		if (series.kind !== collection) return [];
		const items: SeriesItem[] = series.items;
		const position = items.findIndex((item) => itemKey(item) === key);
		if (position === -1) return [];
		return [
			{
				series: { slug: series.slug, label: series.label, kind: series.kind },
				index: position + 1,
				total: items.length,
				prev: items[position - 1] ?? null,
				next: items[position + 1] ?? null,
			},
		];
	});
}
