import { getCmsContentStore } from "@/cms/container";
import { adminRoute, json } from "../../../handler";

/** 최신 초안을 새 ID의 초안으로 복제한다(§6.3). */
export const POST = adminRoute<{ id: string }>(async ({ params }) =>
	json(await getCmsContentStore().duplicateEntry({ id: params.id }), { status: 201 }),
);
