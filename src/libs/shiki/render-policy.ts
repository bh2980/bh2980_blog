import type { AnnotationConfig } from "@/libs/annotation/code-block/types";

const RENDER_TAG_RE = /^[A-Za-z][A-Za-z0-9._-]*$/;
const BLOCKED_RENDER_TAGS = new Set(["script", "iframe", "object", "embed", "style", "link", "meta", "base"]);

const normalizeRenderTag = (tag: string) => tag.trim();

export const isSafeRenderTag = (tag: string) => {
	const normalized = normalizeRenderTag(tag);
	if (!normalized || !RENDER_TAG_RE.test(normalized)) {
		return false;
	}

	return !BLOCKED_RENDER_TAGS.has(normalized.toLowerCase());
};

export const createAllowedRenderTagsFromConfig = (annotationConfig: AnnotationConfig): string[] => {
	const tags = new Set<string>();
	const items = [...(annotationConfig.inlineWrap ?? []), ...(annotationConfig.lineWrap ?? [])];

	for (const item of items) {
		if (typeof item.render !== "string") continue;
		const normalized = normalizeRenderTag(item.render);
		if (!isSafeRenderTag(normalized)) continue;
		tags.add(normalized);
	}

	return [...tags];
};
