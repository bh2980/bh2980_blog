import { cookies } from "next/headers";

const isLocalMode = () => process.env.NODE_ENV === "development";

const isAdminUser = async (accessToken: string) => {
	const owner = process.env.NEXT_PUBLIC_KEYSTATIC_OWNER;
	if (!owner) {
		return false;
	}

	const response = await fetch(`https://api.github.com/user`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
		},
		cache: "no-store",
	});

	if (!response.ok) return false;

	const user = (await response.json()) as { login: string };

	return user.login === owner;
};

const getAccessToken = async () => {
	const cookieStore = await cookies();

	const accessToken = cookieStore.get("keystatic-gh-access-token");

	return accessToken?.value.trim();
};

export const verifyAccess = async () => {
	if (isLocalMode()) return true;

	const accessToken = await getAccessToken();

	if (!accessToken) return false;

	try {
		return await isAdminUser(accessToken);
	} catch (error) {
		console.error("Failed to verify keystatic session", error);
		return false;
	}
};
