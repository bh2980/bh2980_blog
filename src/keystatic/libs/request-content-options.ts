import { cookies, draftMode } from "next/headers";
import type { ContentAccessOptions } from "./content-access-options";
import { isRemotePreviewEnabled } from "./runtime";

export const getPreviewContentOptionsFromRequest = async (): Promise<ContentAccessOptions> => {
	if (!isRemotePreviewEnabled()) {
		return {};
	}

	try {
		const { isEnabled } = await draftMode();

		if (!isEnabled) {
			return {};
		}

		const cookieStore = await cookies();
		const branch = cookieStore.get("ks-branch")?.value;
		const token = cookieStore.get("keystatic-gh-access-token")?.value;

		if (!branch || !token) {
			return {};
		}

		return {
			preview: {
				branch,
				token,
			},
		};
	} catch {
		return {};
	}
};
