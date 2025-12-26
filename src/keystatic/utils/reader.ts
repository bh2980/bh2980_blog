import { createGitHubReader } from "@keystatic/core/reader/github";
import keystaticConfig from "@/root/keystatic.config";

export const reader = (() => {
	return createGitHubReader(keystaticConfig, {
		repo: "bh2980/bh2980_blog",
		token: process.env.GITHUB_PAT,
	});
})();
