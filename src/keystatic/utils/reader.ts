import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import keystaticConfig from "@/root/keystatic.config";

export const reader = (() => {
	if (process.env.NODE_ENV === "development") {
		return createReader(process.cwd(), keystaticConfig);
	}

	if (!process.env.GITHUB_PAT) {
		throw new Error("GITHUB_PAT is not defined");
	}

	return createGitHubReader(keystaticConfig, {
		repo: "bh2980/bh2980_blog",
		token: process.env.GITHUB_PAT,
	});
})();
