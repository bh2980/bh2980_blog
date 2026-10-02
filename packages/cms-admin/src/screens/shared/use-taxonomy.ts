"use client";

import { COLLECTION_DEFINITIONS, isCollection, taxonomyFieldsOf } from "@bh2980/cms/core/collections";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cmsFetch } from "../admin-api";

/** 이름만으로 만들 수 있는 record 컬렉션(§5.2) 이름. 관계 필드의 선택지와 바로 만들기(v2 B2)에 쓴다. */
export type RecordCollection = string;

/** 분류 필드 이름 → 그 필드가 가리키는 컬렉션의 선택지. */
export type TaxonomyOptions = Readonly<Record<string, readonly TaxonomyOption[]>>;

const labelOf = (collection: string) =>
	isCollection(collection) ? COLLECTION_DEFINITIONS[collection].label : collection;

export interface TaxonomyOption {
	id: string;
	title: string;
	slug: string | null;
}

type ListResponse = { items: { id: string; title: string | null; slug: string | null }[]; total: number };

/** 활성(공개) record 전체. 100개를 넘으면 다음 페이지도 읽는다. */
async function loadAll(collection: RecordCollection): Promise<TaxonomyOption[]> {
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
 * 편집 화면·일괄 작업·목록 필터가 함께 쓰는 태그·카테고리 등 record 선택지.
 * `create`는 제목만으로 새 레코드를 만든다(slug는 서버가 제목에서 만든다).
 */
export function useTaxonomy(collection: RecordCollection, enabled = true) {
	const [options, setOptions] = useState<TaxonomyOption[]>([]);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		try {
			setOptions(await loadAll(collection));
			setError(null);
		} catch {
			setError(`${labelOf(collection)} 목록을 불러오지 못했습니다.`);
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

/**
 * 컬렉션의 분류 필드(태그·카테고리 등) 선택지를 필드 이름별로 읽는다. 목록 필터·일괄 작업·행 메뉴가 쓴다.
 * 같은 컬렉션을 가리키는 필드는 한 번만 읽는다.
 */
export function useTaxonomyOptions(collection: string, enabled = true): TaxonomyOptions {
	const fields = useMemo(() => taxonomyFieldsOf(collection), [collection]);
	const targets = useMemo(() => [...new Set(fields.map((stored) => stored.to))], [fields]);
	const combine = useCallback(
		(results: { data?: TaxonomyOption[] }[]): TaxonomyOptions =>
			Object.fromEntries(fields.map((stored) => [stored.name, results[targets.indexOf(stored.to)]?.data ?? []])),
		[fields, targets],
	);
	return useQueries({
		queries: targets.map((target) => ({
			// 목록 캐시 아래에 두어 목록을 다시 받을 때 함께 새로 받는다.
			queryKey: ["cms", "entries", "taxonomy", target],
			queryFn: () => loadAll(target),
			enabled,
		})),
		combine,
	});
}
