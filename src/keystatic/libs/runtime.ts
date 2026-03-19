import type { ContentAccessOptions } from "@/libs/contents/types";

export const isRemotePreviewEnabled = () => process.env.KEYSTATIC_REMOTE_PREVIEW === "true";

export const shouldUseRemotePreview = (options: ContentAccessOptions = {}) =>
	Boolean(options.preview && isRemotePreviewEnabled());

export const shouldHideDraftContent = (options: ContentAccessOptions = {}) =>
	process.env.NODE_ENV !== "development" && !options.preview;
