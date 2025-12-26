import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	if (req.headers.get("origin") !== new URL(req.url).origin) {
		return new Response("Invalid origin", { status: 400 });
	}

	const referrer = req.headers.get("referer");
	if (!referrer) {
		return new Response("Missing referer", { status: 400 });
	}

	const dm = await draftMode();
	dm.disable();

	// create NextResponse and delete cookie on the response
	const res = NextResponse.redirect(referrer, 303);
	res.cookies.delete({ name: "ks-branch", path: "/" }); // path 맞춰서 삭제

	return res;
}
