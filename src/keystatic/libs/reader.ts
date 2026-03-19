import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import { cookies, draftMode } from "next/headers";
import keystaticConfig from "@/root/keystatic.config";
import { isRemotePreviewEnabled } from "./runtime";

export const reader = async () => {
	let isDraftModeEnabled = false;

	try {
		const draftModeStore = await draftMode();

		isDraftModeEnabled = draftModeStore.isEnabled;
	} catch (error) {
		console.error(error);
	}

	if (isRemotePreviewEnabled() && isDraftModeEnabled) {
		const cookieStore = await cookies();
		const branch = cookieStore.get("ks-branch")?.value;

		if (branch) {
			return createGitHubReader(keystaticConfig, {
				repo: `${process.env.NEXT_PUBLIC_KEYSTATIC_OWNER}/${process.env.NEXT_PUBLIC_KEYSTATIC_REPO}`,
				ref: branch,
				token: cookieStore.get("keystatic-gh-access-token")?.value,
			});
		}
	}

	return createReader(process.cwd(), keystaticConfig);
};
