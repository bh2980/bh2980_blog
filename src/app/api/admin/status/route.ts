import { getAdminContext } from "@/libs/admin/context";

export async function GET() {
	const adminContext = await getAdminContext();

	return Response.json(adminContext, {
		headers: {
			"Cache-Control": "private, no-store, no-cache, max-age=0",
		},
	});
}
