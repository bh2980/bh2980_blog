import { getCmsContentService, getCmsContentStore } from "@/cms/container";
import { patchEntryBodySchema } from "@/cms/core/api";
import type { SaveDraftInput } from "@/cms/services/types";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/** 항목과 편집 화면에 필요한 예약 상태(§5.4). */
export const GET = adminRoute<IdParams>(async ({ params }) => {
	const store = getCmsContentStore();
	const entry = await store.getEntry(params.id);
	const schedule = await store.getEntrySchedule({ entryId: params.id });
	return json({
		...entry,
		schedule: { ...schedule, runnerConfigured: Boolean(process.env.CMS_SCHEDULER_TOKEN?.trim()) },
	});
});

/** 최신 초안 저장. 보내지 않은 필드는 현재 초안 값을 유지한다. */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, patchEntryBodySchema);
	const current = await getCmsContentStore().getEntry(params.id);
	const input = {
		collection: current.collection,
		expectedVersion: body.expectedVersion,
		slug: body.slug !== undefined ? body.slug : current.workingSlug,
		metadata: body.metadata ?? current.working.metadata,
		mdx: body.mdx ?? current.working.mdx,
		...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
	} as SaveDraftInput;
	return json(await getCmsContentService().saveDraft(params.id, input));
});

/** 휴지통 항목의 영구 삭제(§5.3). 휴지통 이동은 `POST /entries/:id/trash`다. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	const expectedVersion = readVersionQuery(request);
	await getCmsContentStore().permanentDeleteEntry({ id: params.id, expectedVersion });
	return new Response(null, { status: 204 });
});
