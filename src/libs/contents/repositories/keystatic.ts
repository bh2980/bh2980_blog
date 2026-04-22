import "server-only";

import { reader } from "@/keystatic/libs/reader";
import { isDefined } from "@/utils/is-defined";
import { sanitize } from "@/utils/sanitize";
import type { ContentRepository } from "../contracts/repository";
import type { Category, Memo, Post, Series, Tag } from "../types/contents";
import type { MemoListQuery, PostListQuery } from "../types/query";

export class KeystaticRepository implements ContentRepository {
	async getPost(slug: string): Promise<Post | null> {
		const r = await reader();
		const normalizedSlug = sanitize(slug);
		const post = await r.collections.post.read(normalizedSlug);

		if (!post?.category) {
			return null;
		}

		const normalizedCategorySlug = sanitize(post.category);
		const category = await r.collections.category.read(normalizedCategorySlug);

		if (!category) {
			return null;
		}

		const tags = (
			await Promise.all(
				post.tags.map(sanitize).map(async (tagSlug) => {
					const tag = await r.collections.tag.read(tagSlug);
					if (!tag) return null;
					return { slug: tagSlug, label: tag.name };
				}),
			)
		).filter(isDefined<Tag>);

		const contentMdx = await post.content();

		const isEvergreen = post.policy.discriminant === "evergreen";

		return {
			slug: normalizedSlug,
			status: post.status,
			title: post.title,
			excerpt: post.excerpt,
			category: { label: category.name, slug: normalizedCategorySlug },
			tags,
			contentMdx,
			publishedAt: post.publishedDateTimeISO,
			isEvergreen,
		};
	}
	async getMemo(slug: string): Promise<Memo | null> {
		const r = await reader();
		const normalizedSlug = sanitize(slug);
		const memo = await r.collections.memo.read(normalizedSlug);

		if (!memo) {
			return null;
		}

		const tags = (
			await Promise.all(
				memo.tags.map(sanitize).map(async (tagSlug) => {
					const tag = await r.collections.tag.read(tagSlug);
					if (!tag) return null;

					return { slug: tagSlug, label: tag.name };
				}),
			)
		).filter(isDefined<Tag>);

		const contentMdx = await memo.content();

		return {
			slug: normalizedSlug,
			status: "published",
			title: memo.title,
			contentMdx,
			tags,
			publishedAt: memo.publishedDateTimeISO,
		};
	}
	async getSeries(slug: string): Promise<Series | null> {
		const r = await reader();
		const normalizedSlug = sanitize(slug);
		const series = await r.collections.collection.read(normalizedSlug);

		if (!series) {
			return null;
		}

		const items = (await Promise.all(series.items.map((itemSlug) => this.getPost(itemSlug)))).filter(isDefined<Post>);

		return { slug: normalizedSlug, items, label: series.name, description: series.description };
	}
	async listPosts(query: PostListQuery = {}): Promise<Post[]> {
		const r = await reader();

		const postSlugList = await r.collections.post.list();

		const postList = (await Promise.all(postSlugList.map((postSlug) => this.getPost(postSlug)))).filter(isDefined);

		return applyPostListQuery(postList, query);
	}
	async listPostSlugs(): Promise<string[]> {
		const r = await reader();

		return (await r.collections.post.list()).map((slug) => sanitize(slug));
	}
	async listMemos(query: MemoListQuery = {}): Promise<Memo[]> {
		const r = await reader();

		const memoSlugList = await r.collections.memo.list();

		const memoList = (await Promise.all(memoSlugList.map((memoSlug) => this.getMemo(memoSlug)))).filter(isDefined);

		return applyMemoListQuery(memoList, query);
	}
	async listMemoSlugs(): Promise<string[]> {
		const r = await reader();

		return (await r.collections.memo.list()).map((slug) => sanitize(slug));
	}
	async listCategories(): Promise<Category[]> {
		const r = await reader();

		const categorySlugList = (await r.collections.category.list()).map(sanitize);

		const categoryList = (
			await Promise.all(
				categorySlugList.map(async (categorySlug) => {
					const category = await r.collections.category.read(categorySlug);
					if (!category) {
						return null;
					}

					return { label: category.name, slug: categorySlug };
				}),
			)
		).filter(isDefined<Category>);

		return categoryList;
	}
	async listTags(): Promise<Tag[]> {
		const r = await reader();

		const tagSlugList = (await r.collections.tag.list()).map(sanitize);

		const tagList = (
			await Promise.all(
				tagSlugList.map(async (tagSlug) => {
					const tag = await r.collections.tag.read(tagSlug);
					if (!tag) {
						return null;
					}

					return { label: tag.name, slug: tagSlug };
				}),
			)
		).filter(isDefined<Tag>);

		return tagList;
	}
	async listSeries(): Promise<Series[]> {
		const r = await reader();

		const seriesSlugList = (await r.collections.collection.list()).map(sanitize);

		const seriesList = (
			await Promise.all(
				seriesSlugList.map(async (seriesSlug) => {
					const series = await this.getSeries(seriesSlug);
					if (!series) {
						return null;
					}

					return series;
				}),
			)
		).filter(isDefined<Series>);

		return seriesList;
	}
}

function applyPostListQuery(posts: Post[], query: PostListQuery): Post[] {
	let result = posts;

	if (query.status) {
		result = result.filter((post) => post.status === query.status);
	}

	if (query.category) {
		result = result.filter((post) => post.category.slug === query.category);
	}

	if (query.tag) {
		result = result.filter((post) => post.tags.some((tag) => tag.slug === query.tag));
	}

	return result;
}

function applyMemoListQuery(memos: Memo[], query: MemoListQuery): Memo[] {
	let result = memos;

	if (query.tag) {
		result = result.filter((memo) => memo.tags.some((tag) => tag.slug === query.tag));
	}

	return result;
}
