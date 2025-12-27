import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import keystaticConfig from "@/root/keystatic.config";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const origin = url.origin;

	const to = url.searchParams.get("to");
	if (!to) return new Response("Missing branch or to params", { status: 400 });

	const toUrl = new URL(to, origin);
	if (toUrl.origin !== origin) {
		return new Response("Invalid redirect URL", { status: 400 });
	}

	if (keystaticConfig.storage.kind === "local") {
		return NextResponse.redirect(toUrl.toString());
	}

	const branch = url.searchParams.get("branch");
	if (!branch) return new Response("Missing branch or to params", { status: 400 });

	(await draftMode()).enable();

	const res = NextResponse.redirect(toUrl.toString());
	res.cookies.set("ks-branch", branch, { path: "/" });
	return res;
}
