type CookieValue = { value: string } | undefined;

type CookieStoreLike = {
	get: (name: string) => CookieValue;
};

const getCookieValue = (cookieStore: CookieStoreLike, name: string) => {
	const value = cookieStore.get(name)?.value;
	return value?.trim() || undefined;
};

const isLocalMode = () => process.env.NODE_ENV === "development";

const hasRepoAccess = async (accessToken: string) => {
	const owner = process.env.NEXT_PUBLIC_KEYSTATIC_OWNER;
	const name = process.env.NEXT_PUBLIC_KEYSTATIC_REPO;
	if (!owner || !name) {
		return false;
	}

	const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
		},
		cache: "no-store",
	});

	return response.ok;
};

export const hasVerifiedKeystaticSession = async (cookieStore: CookieStoreLike) => {
	if (isLocalMode()) {
		return true;
	}

	const accessToken = getCookieValue(cookieStore, "keystatic-gh-access-token");
	if (!accessToken) {
		return false;
	}

	try {
		return await hasRepoAccess(accessToken);
	} catch (error) {
		console.error("Failed to verify keystatic session", error);
		return false;
	}
};
