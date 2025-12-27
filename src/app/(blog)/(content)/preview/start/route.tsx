import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import keystaticConfig from "@/root/keystatic.config";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const branch = url.searchParams.get("branch");
	const to = url.searchParams.get("to");

	if (to && keystaticConfig.storage.kind === "local") {
		const toUrl = new URL(to, url.origin);
		return NextResponse.redirect(toUrl.toString());
	}

	if (!branch || !to) {
		return new Response("Missing branch or to params", { status: 400 });
	}

	const dm = await draftMode();
	dm.enable();

	const toUrl = new URL(to, url.origin);
	const res = NextResponse.redirect(toUrl.toString());
	res.cookies.set("ks-branch", branch, { path: "/" });

	return res;
}
