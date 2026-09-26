"use client";

import { useCallback, useEffect, useState } from "react";
import { cmsFetch } from "../admin-api";

export interface TaxonomyOption {
	id: string;
	title: string;
	slug: string | null;
}

type ListResponse = { items: { id: string; title: string | null; slug: string | null }[]; total: number };

/** 활성(공개) 태그·카테고리 전체. 100개를 넘으면 다음 페이지도 읽는다. */
async function loadAll(collection: "tag" | "category"): Promise<TaxonomyOption[]> {
	const options: TaxonomyOption[] = [];
	for (let page = 1; page < 50; page++) {
		const params = new URLSearchParams({
			collection,
			pageSize: "100",
			page: String(page),
			sortField: "title",
			sortDirection: "asc",
		});
		params.append("status", "published");
		const data = await cmsFetch<ListResponse>(`/api/cms/v1/entries?${params.toString()}`);
		options.push(
			...data.items.map((item) => ({ id: item.id, title: item.title || item.slug || "이름 없음", slug: item.slug })),
		);
		if (options.length >= data.total || data.items.length === 0) break;
	}
	return options;
}

/**
 * 편집 화면·일괄 작업·목록 필터가 함께 쓰는 태그·카테고리 선택지.
 * `create`는 제목만으로 새 레코드를 만든다(slug는 서버가 제목에서 만든다).
 */
export function useTaxonomy(collection: "tag" | "category", enabled = true) {
	const [options, setOptions] = useState<TaxonomyOption[]>([]);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		try {
			setOptions(await loadAll(collection));
			setError(null);
		} catch {
			setError(`${collection === "tag" ? "태그" : "카테고리"} 목록을 불러오지 못했습니다.`);
		}
	}, [collection]);

	useEffect(() => {
		if (enabled) void reload();
	}, [enabled, reload]);

	const create = useCallback(
		async (title: string): Promise<TaxonomyOption> => {
			const created = await cmsFetch<{ id: string; publishedSlug: string | null }>("/api/cms/v1/entries", {
				method: "POST",
				json: { collection, metadata: { title: title.trim() }, mdx: "" },
				fallback: "만들지 못했습니다.",
			});
			const option = { id: created.id, title: title.trim(), slug: created.publishedSlug };
			setOptions((current) => [...current, option]);
			return option;
		},
		[collection],
	);

	return { options, error, reload, create };
}
