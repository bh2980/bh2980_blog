import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { isRemotePreviewEnabled } from "@/keystatic/libs/runtime";
import { checkPreviewAccess } from "@/libs/admin/preview-access";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const origin = url.origin;

	const to = url.searchParams.get("to");
	if (!to) return new Response("Missing branch or to params", { status: 400 });

	let toUrl: URL;
	try {
		toUrl = new URL(to, origin);
	} catch {
		return new Response("Invalid redirect URL", { status: 400 });
	}
	if (toUrl.origin !== origin) {
		return new Response("Invalid redirect URL", { status: 400 });
	}

	// 관리자 세션이 없으면 draftMode를 켜지 않는다(M7-FE-1 / O1 A9).
	const access = await checkPreviewAccess();
	if (!access.granted) {
		return new Response("Preview requires an admin session", { status: access.status });
	}

	if (!isRemotePreviewEnabled()) {
		return NextResponse.redirect(toUrl.toString());
	}

	const branch = url.searchParams.get("branch");
	if (!branch) return new Response("Missing branch or to params", { status: 400 });

	(await draftMode()).enable();

	const res = NextResponse.redirect(toUrl.toString());
	res.cookies.set("ks-branch", branch, { path: "/" });
	return res;
}
