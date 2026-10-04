import "server-only";

import { getEntry, getTranslations, listEntries, type ReadEntry } from "@monti-cms/core/read";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/libs/i18n/locales";
import { isDefined } from "@/utils/is-defined";
import type { ContentRepository } from "../contracts/repository";
import { readMetadataString } from "../metadata";
import { asLocale, toPublishedMemo, toPublishedPost } from "../read-model";
import { normalizeSlug } from "../slug";
import type { Category, Memo, Post, PublishedMemo, PublishedPost, Series, Tag } from "../types/contents";
import type { MemoListQuery, PostListQuery } from "../types/query";

/**
 * M7-BE-1: CMS DB의 공개본만 읽는 ContentRepository 구현. 읽기는 라이브러리의 `@monti-cms/core/read`가 하고,
 * 이 파일은 그 결과를 이 블로그의 글·메모 모양으로 옮기기만 한다(옮기는 규칙은 `../read-model.ts`).
 *
 * - 초안·보관·휴지통은 반환하지 않는다(O1 A3). 호출자의 status 필터와 무관하게 공개본만 나온다.
 * - 과거 주소(alias)로 조회하면 정규 current slug를 가진 항목을 반환한다(O1 A4/A8).
 *   호출자는 `entry.slug !== 요청 slug`인 경우 308로 보낸다.
 * - 목록 결과의 `contentMdx`는 빈 문자열이다. 본문은 상세 조회(getPost/getMemo)에서만 읽는다.
 *   (목록마다 전 본문을 전송하면 페이지 페이로드가 커진다. 소비자는 상세 조회만 본문을 쓴다.)
 * - 카테고리·태그 필터는 주소(slug)를 항목 ID로 바꿔 DB에서 거른다.
 * - DB·환경 오류는 삼키지 않고 그대로 throw한다. 호출자는 이를 5xx로 처리한다(O1 A3).
 */

/** 한 번에 읽는 쪽 크기(라이브러리 상한). 목록 전체가 필요하면 쪽을 넘겨 가며 모두 읽는다. */
const PAGE_SIZE = 500;

type BlogCollection = "post" | "memo" | "category" | "tag" | "collection";

/** 한 컬렉션·언어의 공개본 전부. 쪽 나누기·관계 조건·정렬은 DB가 한다. */
async function listAll<C extends BlogCollection>(params: {
	collection: C;
	locale: Locale;
	where?: Readonly<Record<string, string>>;
	sort?: "publishedAt" | "updatedAt";
}): Promise<ReadEntry<C>[]> {
	const items: ReadEntry<C>[] = [];
	for (let page = 1; ; page += 1) {
		const result = await listEntries({ ...params, page, pageSize: PAGE_SIZE });
		items.push(...result.items);
		if (result.items.length === 0 || items.length >= result.total) return items;
	}
}

/** 주소(slug)가 가리키는 공개된 분류 항목의 ID. 없는 주소이거나 옛 주소면 `null`이다. */
async function itemIdOf(collection: "category" | "tag", slug: string): Promise<string | null> {
	const result = await getEntry({ collection, slug });
	return result.status === "found" ? result.entry.translationGroupId : null;
}

/** 분류 항목(카테고리·태그·모음집)의 이 언어 이름. 없으면 주소다. */
const labelOf = (entry: ReadEntry): string => entry.title?.trim() || entry.slug;

/** record 컬렉션(모음집)의 언어별 설명. 없으면 기본 언어 값을 쓴다(v2 B4). */
function readLocalizedSummary(entry: ReadEntry, locale: Locale): string | null {
	const metadata = entry.metadata as Record<string, unknown>;
	if (locale !== DEFAULT_LOCALE) {
		const values = (metadata.translations as Record<string, unknown> | undefined)?.[locale];
		if (values && typeof values === "object" && !Array.isArray(values)) {
			const value = readMetadataString(values as Record<string, unknown>, "summary");
			if (value) return value;
		}
	}
	return readMetadataString(metadata, "summary");
}

/** 모음집. 항목은 이 언어 번역본이 공개된 글만 보여 준다(v2 B4). 기본 언어는 원문 그대로다. */
function toSeries(entry: ReadEntry, postsByGroup: ReadonlyMap<string, PublishedPost>, locale: Locale): Series {
	const description = readLocalizedSummary(entry, locale);
	return {
		slug: entry.slug,
		label: labelOf(entry),
		...(description ? { description } : {}),
		items: (entry.relations.itemIds ?? []).map((item) => postsByGroup.get(item.id)).filter(isDefined<PublishedPost>),
	};
}

export class PostgresRepository implements ContentRepository {
	/** 이 언어의 공개 게시글을 번역 묶음 ID별로 모은다. 모음집 항목을 고를 때 쓴다. */
	private async loadPostsByGroup(locale: Locale): Promise<Map<string, PublishedPost>> {
		const entries = await listAll({ collection: "post", locale });
		const posts = entries.map(toPublishedPost).filter(isDefined<PublishedPost>);
		return new Map(posts.map((post) => [post.translationGroupId ?? post.slug, post]));
	}

	async getPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Post | null> {
		const normalized = normalizeSlug(slug);
		// 빌드 수집 단계에서 빈 slug로 들어올 수 있다. 저장소를 부르지 않고 404로 끝낸다
		// (파일 기반 경로의 `read("")`가 null을 돌려주던 동작과 같다).
		if (!normalized) return null;

		const result = await getEntry({ collection: "post", slug: normalized, locale });
		if (result.status === "not_found") return null;

		return toPublishedPost(result.entry);
	}

	async getMemo(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Memo | null> {
		const normalized = normalizeSlug(slug);
		// 빌드 수집 단계에서 빈 slug로 들어올 수 있다. 저장소를 부르지 않고 404로 끝낸다.
		if (!normalized) return null;

		const result = await getEntry({ collection: "memo", slug: normalized, locale });
		if (result.status === "not_found") return null;

		return toPublishedMemo(result.entry);
	}

	async listPosts(query: PostListQuery = {}, locale: Locale = DEFAULT_LOCALE): Promise<Post[]> {
		const where: Record<string, string> = {};
		if (query.category) {
			const id = await itemIdOf("category", query.category);
			if (!id) return [];
			where.categoryId = id;
		}
		if (query.tag) {
			const id = await itemIdOf("tag", query.tag);
			if (!id) return [];
			where.tagIds = id;
		}

		const entries = await listAll({ collection: "post", locale, where, sort: "publishedAt" });

		return entries.map(toPublishedPost).filter(isDefined<PublishedPost>);
	}

	async listPostSlugs(locale: Locale = DEFAULT_LOCALE): Promise<string[]> {
		const entries = await listAll({ collection: "post", locale, sort: "updatedAt" });

		return entries.map((entry) => entry.slug);
	}

	async listMemos(query: MemoListQuery = {}, locale: Locale = DEFAULT_LOCALE): Promise<Memo[]> {
		const where: Record<string, string> = {};
		if (query.tag) {
			const id = await itemIdOf("tag", query.tag);
			if (!id) return [];
			where.tagIds = id;
		}

		const entries = await listAll({ collection: "memo", locale, where, sort: "publishedAt" });

		return entries.map(toPublishedMemo).filter(isDefined<PublishedMemo>);
	}

	async listMemoSlugs(locale: Locale = DEFAULT_LOCALE): Promise<string[]> {
		const entries = await listAll({ collection: "memo", locale, sort: "updatedAt" });

		return entries.map((entry) => entry.slug);
	}

	async listCategories(locale: Locale = DEFAULT_LOCALE): Promise<Category[]> {
		const entries = await listAll({ collection: "category", locale, sort: "updatedAt" });

		return entries.map((entry) => ({ slug: entry.slug, label: labelOf(entry) }));
	}

	async listTags(locale: Locale = DEFAULT_LOCALE): Promise<Tag[]> {
		const entries = await listAll({ collection: "tag", locale, sort: "updatedAt" });

		return entries.map((entry) => ({ slug: entry.slug, label: labelOf(entry) }));
	}

	async listSeries(locale: Locale = DEFAULT_LOCALE): Promise<Series[]> {
		const [seriesEntries, postsByGroup] = await Promise.all([
			listAll({ collection: "collection", locale, sort: "updatedAt" }),
			this.loadPostsByGroup(locale),
		]);

		return seriesEntries.map((entry) => toSeries(entry, postsByGroup, locale));
	}

	async getSeries(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Series | null> {
		const result = await getEntry({ collection: "collection", slug, locale });
		// 옛 주소(alias)로는 찾지 않는다. 정규 주소만 모음집 주소다.
		if (result.status !== "found") return null;

		return toSeries(result.entry, await this.loadPostsByGroup(locale), locale);
	}

	async listTranslations(
		_collection: "post" | "memo",
		translationGroupId: string,
	): Promise<{ locale: Locale; slug: string }[]> {
		// 번역 묶음 ID는 컬렉션과 관계없이 유일하므로 컬렉션은 따로 거르지 않는다.
		const members = await getTranslations({ translationGroupId });

		return members
			.filter((member) => isLocale(member.locale))
			.map((member) => ({ locale: asLocale(member.locale), slug: member.slug }));
	}

	async listLocalizedAddresses(locale: Locale): Promise<Map<string, string>> {
		const addresses = new Map<string, string>();
		if (locale === DEFAULT_LOCALE) return addresses;

		for (const collection of ["post", "memo"] as const) {
			// 이 언어의 번역본이 있는 글만 원문 주소를 찾는다. 다른 언어는 읽지 않는다.
			const localized = await listAll({ collection, locale });
			if (localized.length === 0) continue;
			const sources = new Map(
				(await listAll({ collection, locale: DEFAULT_LOCALE })).map((entry) => [entry.translationGroupId, entry.slug]),
			);
			for (const entry of localized) {
				const base = sources.get(entry.translationGroupId);
				if (base) addresses.set(`${collection}:${base}`, entry.slug);
			}
		}
		return addresses;
	}
}
