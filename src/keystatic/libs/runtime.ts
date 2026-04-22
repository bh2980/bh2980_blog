import type { ContentAccessOptions } from "@/libs/contents/types/legacy";

const hasRemoteKeystaticConfig = () =>
	Boolean(process.env.NEXT_PUBLIC_KEYSTATIC_OWNER && process.env.NEXT_PUBLIC_KEYSTATIC_REPO);

export const isRemotePreviewEnabled = () => process.env.NODE_ENV !== "development" && hasRemoteKeystaticConfig();

export const shouldUseRemotePreview = (options: ContentAccessOptions = {}) =>
	Boolean(options.preview && isRemotePreviewEnabled());

export const shouldHideDraftContent = (options: ContentAccessOptions = {}) =>
	process.env.NODE_ENV !== "development" && !options.preview;
