import { type NextRequest, NextResponse } from "next/server";
import { authGateway } from "@/cms/adapters/auth";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { handleApiError } from "../error-handler";

export async function GET(request: NextRequest) {
	try {
		await authGateway.verifyAdmin();

		const url = new URL(request.url);
		const search = url.searchParams.get("search") || undefined;
		const mimeType = url.searchParams.get("mimeType") || undefined;
		const used = (url.searchParams.get("used") as "all" | "used" | "unused") || "all";
		const page = Number(url.searchParams.get("page")) || 1;
		const pageSize = Number(url.searchParams.get("pageSize")) || 25;

		const store = getCmsContentStore();
		const mediaStore = getCmsMediaStore();

		const result = await store.listMediaAssets({
			search,
			mimeType,
			used,
			page,
			pageSize,
		});

		// Attach publicUrl for convenience
		const itemsWithUrl = result.items.map((item) => ({
			...item,
			publicUrl: item.storageKey ? mediaStore.getPublicUrl(item.storageKey) : null,
		}));

		return NextResponse.json({
			...result,
			items: itemsWithUrl,
		});
	} catch (error) {
		return handleApiError(error);
	}
}
