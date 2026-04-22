import { reader } from "@/keystatic/libs/reader";
import { isDefined } from "@/utils/is-defined";
import type { ContentRepository } from "../contracts/repository";
import type { Category, ListResult, Memo, Post, Series, Tag } from "../types/contents";

export class KeystaticRepository implements ContentRepository {
	async getPost(slug: string): Promise<Post | null> {
		const r = await reader();
		const post = await r.collections.post.read(slug);

		if (!post?.category) {
			return null;
		}

		const category = await r.collections.category.read(post.category);

		if (!category) {
			return null;
		}

		const tags = (
			await Promise.all(
				post.tags.map(async (tagSlug) => {
					const tag = await r.collections.tag.read(tagSlug);
					if (!tag) return null;
					return { slug: tagSlug, label: tag.name };
				}),
			)
		).filter(isDefined<Tag>);

		const contentMdx = await post.content();

		return {
			slug,
			status: post.status,
			title: post.title,
			excerpt: post.excerpt,
			category: { label: category.name, slug: post.category },
			tags,
			contentMdx,
			publishedAt: post.publishedDateTimeISO,
		};
	}
	async getMemo(slug: string): Promise<Memo | null> {
		const r = await reader();
		const memo = await r.collections.memo.read(slug);

		if (!memo) {
			return null;
		}

		const tags = (
			await Promise.all(
				memo.tags.map(async (tagSlug) => {
					const tag = await r.collections.tag.read(tagSlug);
					if (!tag) return null;

					return { slug: tagSlug, label: tag.name };
				}),
			)
		).filter(isDefined<Tag>);

		const contentMdx = await memo.content();

		return { slug, status: "published", title: memo.title, contentMdx, tags, publishedAt: memo.publishedDateTimeISO };
	}
	async getSeries(slug: string): Promise<Series | null> {
		const r = await reader();
		const series = await r.collections.collection.read(slug);

		if (!series) {
			return null;
		}

		const items = (await Promise.all(series.items.map((itemSlug) => this.getPost(itemSlug)))).filter(isDefined<Post>);

		return { slug, items, label: series.name, description: series.description };
	}
	async listPosts(): Promise<ListResult<Post>> {
		const r = await reader();

		const postSlugList = await r.collections.post.list();

		const postList = (await Promise.all(postSlugList.map((postSlug) => this.getPost(postSlug)))).filter(isDefined);

		return {
			list: postList,
			total: postList.length,
		};
	}
	async listMemos(): Promise<ListResult<Memo>> {
		const r = await reader();

		const memoSlugList = await r.collections.memo.list();

		const memoList = (await Promise.all(memoSlugList.map((memoSlug) => this.getMemo(memoSlug)))).filter(isDefined);

		return {
			list: memoList,
			total: memoList.length,
		};
	}
	async listCategories(): Promise<ListResult<Category>> {
		const r = await reader();

		const categorySlugList = await r.collections.category.list();

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

		return {
			list: categoryList,
			total: categoryList.length,
		};
	}
	async listTags(): Promise<ListResult<Tag>> {
		const r = await reader();

		const tagSlugList = await r.collections.tag.list();

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

		return {
			list: tagList,
			total: tagList.length,
		};
	}
	async listSeries(): Promise<ListResult<Series>> {
		const r = await reader();

		const seriesSlugList = await r.collections.collection.list();

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

		return {
			list: seriesList,
			total: seriesList.length,
		};
	}
}
