import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import { cookies, draftMode } from "next/headers";
import keystaticConfig from "@/root/keystatic.config";

export const reader = async () => {
	let isDraftModeEnabled = false;

	try {
		const draftModeStore = await draftMode();

		isDraftModeEnabled = draftModeStore.isEnabled;
	} catch (error) {
		if (process.env.NODE_ENV === "development") {
			console.error(error);
		}
	}

	if (isDraftModeEnabled) {
		const branch = (await cookies()).get("ks-branch")?.value;

		if (branch) {
			const cookieStore = await cookies();

			return createGitHubReader(keystaticConfig, {
				repo: "bh2980/bh2980_blog",
				ref: branch,
				token: cookieStore.get("keystatic-gh-access-token")?.value,
			});
		}
	}

	if (process.env.NODE_ENV === "development") {
		return createReader(process.cwd(), keystaticConfig);
	}

	return createGitHubReader(keystaticConfig, {
		repo: "bh2980/bh2980_blog",
		token: process.env.GITHUB_PAT,
	});
};
