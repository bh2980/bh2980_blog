import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import { cookies, draftMode } from "next/headers";
import keystaticConfig from "@/root/keystatic.config";

export const reader = async () => {
	if (keystaticConfig.storage.kind === "local") {
		return createReader(process.cwd(), keystaticConfig);
	}

	let isDraftModeEnabled = false;

	try {
		const draftModeStore = await draftMode();

		isDraftModeEnabled = draftModeStore.isEnabled;
	} catch (error) {
		console.error(error);
	}

	if (isDraftModeEnabled) {
		const branch = (await cookies()).get("ks-branch")?.value;

		if (branch) {
			const cookieStore = await cookies();

			return createGitHubReader(keystaticConfig, {
				repo: `${process.env.NEXT_PUBLIC_KEYSTATIC_OWNER}/${process.env.NEXT_PUBLIC_KEYSTATIC_REPO}`,
				ref: branch,
				token: cookieStore.get("keystatic-gh-access-token")?.value,
			});
		}
	}

	return createGitHubReader(keystaticConfig, {
		repo: `${process.env.NEXT_PUBLIC_KEYSTATIC_OWNER}/${process.env.NEXT_PUBLIC_KEYSTATIC_REPO}`,
		token: process.env.GITHUB_PAT,
	});
};
