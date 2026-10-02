import { getCmsContentStore } from "@bh2980/cms/container";
import { z } from "zod";
import { adminRoute, json, readVersionedBody } from "../../../../handler";

type IdParams = { id: string };

/** 기본 기능을 처음 정의로 되돌린다. */
export const POST = adminRoute<IdParams>(async ({ request, params }) => {
	const { expectedVersion } = await readVersionedBody(
		request,
		z.object({ expectedVersion: z.number().int().positive() }),
	);
	return json(await getCmsContentStore().resetAiFeature({ id: params.id, expectedVersion }));
});
