type CookieValue = { value: string } | undefined;

type CookieStoreLike = {
	get: (name: string) => CookieValue;
};

const hasCookieValue = (cookieStore: CookieStoreLike, name: string) => {
	const value = cookieStore.get(name)?.value;
	return Boolean(value?.trim());
};

export const hasKeystaticSession = (cookieStore: CookieStoreLike) =>
	hasCookieValue(cookieStore, "keystatic-gh-access-token") || hasCookieValue(cookieStore, "keystatic-gh-refresh-token");
