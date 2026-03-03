import "server-only";
import { cookies } from "next/headers";
import keystaticConfig from "@/root/keystatic.config";
import { hasVerifiedKeystaticSession } from "./keystatic-auth";
import type { KeystaticMode } from "./keystatic-url";

const getKeystaticMode = (): KeystaticMode => (keystaticConfig.storage.kind === "local" ? "local" : "github");

export const getAdminContext = async (): Promise<{ canManage: boolean; keystaticMode: KeystaticMode }> => {
	const cookieStore = await cookies();
	const canManage = await hasVerifiedKeystaticSession(cookieStore);
	const keystaticMode = getKeystaticMode();

	return { canManage, keystaticMode };
};
