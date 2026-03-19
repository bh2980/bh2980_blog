import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import type { ContentAccessOptions } from "@/libs/contents/types";
import keystaticConfig from "@/root/keystatic.config";
import { shouldUseRemotePreview } from "./runtime";

export const reader = async (options: ContentAccessOptions = {}) => {
	const preview = options.preview;

	if (preview && shouldUseRemotePreview(options)) {
		return createGitHubReader(keystaticConfig, {
			repo: `${process.env.NEXT_PUBLIC_KEYSTATIC_OWNER}/${process.env.NEXT_PUBLIC_KEYSTATIC_REPO}`,
			ref: preview.branch,
			token: preview.token,
		});
	}

	return createReader(process.cwd(), keystaticConfig);
};
