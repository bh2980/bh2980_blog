import { verifyAccess } from "@/libs/admin/verify-access";

export async function GET() {
	const canManage = await verifyAccess();

	return Response.json(canManage, {
		headers: {
			"Cache-Control": "private, no-store, no-cache, max-age=0",
		},
	});
}
