import "server-only";

import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { analyze } from "./analyze";
import { type ImageResolveResult, resolveImageUrl } from "./image-src";

type MdxNode = {
	type?: unknown;
	name?: unknown;
	attributes?: unknown;
	children?: unknown;
};

type MdxAttribute = { name?: unknown; value?: unknown };

const isNode = (value: unknown): value is MdxNode => typeof value === "object" && value !== null;
const isAttribute = (value: unknown): value is MdxAttribute => typeof value === "object" && value !== null;

function readAttribute(node: MdxNode, name: string): string | undefined {
	if (!Array.isArray(node.attributes)) return undefined;
	const attribute = node.attributes.find((item) => isAttribute(item) && item.name === name);
	return typeof attribute?.value === "string" ? attribute.value : undefined;
}

function collectMediaIds(source: string): string[] {
	const ids = new Set<string>();
	const tree = analyze(source).tree;
	const visit = (node: unknown) => {
		if (!isNode(node)) return;
		if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Image") {
			const mediaId = readAttribute(node, "mediaId");
			if (mediaId) ids.add(mediaId);
		}
		if (Array.isArray(node.children)) node.children.forEach(visit);
	};
	visit(tree);
	return [...ids];
}

/** 공개 MDX가 등록 미디어를 실제 공개 URL로 해석하도록 연결한다. */
export async function createPublicImageResolver(source: string) {
	const urls = new Map<string, ImageResolveResult>();
	const mediaIds = collectMediaIds(source);

	if (mediaIds.length > 0) {
		try {
			const store = getCmsContentStore();
			const mediaStore = getCmsMediaStore();
			await Promise.all(
				mediaIds.map(async (mediaId) => {
					const media = await store.getMediaAsset(mediaId);
					if (!media) return;
					if (media.status !== "ready") {
						urls.set(mediaId, { failure: "not-ready" });
						return;
					}
					if (!media.storageKey) {
						urls.set(mediaId, { failure: "unresolved" });
						return;
					}
					const url = mediaStore.getPublicUrl(media.storageKey);
					const { width, height } = media;
					urls.set(mediaId, width && height && width > 0 && height > 0 ? { url, width, height } : { url });
				}),
			);
		} catch {
			// Keystatic/public-only deployments may not configure the CMS database or R2.
			// Keep rendering and let CmsImage show its neutral fallback.
		}
	}

	return ({ mediaId, src }: { mediaId?: string; src?: string }): ImageResolveResult => {
		if (mediaId) return urls.get(mediaId) ?? { failure: "unresolved" };
		return resolveImageUrl(src) ?? { failure: "unresolved" };
	};
}

/**
 * 미디어 하나의 공개 주소(공유 이미지 등). 준비되지 않았거나 DB·저장소가 없는 배포면 `null`이다.
 */
export async function resolvePublicMediaUrl(
	mediaId: string,
): Promise<{ url: string; width?: number; height?: number } | null> {
	try {
		const media = await getCmsContentStore().getMediaAsset(mediaId);
		if (!media || media.status !== "ready" || !media.storageKey) return null;
		const url = getCmsMediaStore().getPublicUrl(media.storageKey);
		return media.width && media.height ? { url, width: media.width, height: media.height } : { url };
	} catch {
		return null;
	}
}
