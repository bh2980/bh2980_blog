import { z } from "zod";
import { getCmsContentStore } from "@/cms/container";
import { adminRoute, assertVersionPresent, json, parseWith, readJsonBody } from "../../../handler";
import { parseFeatureSpec } from "../../ai-route";

type IdParams = { id: string };

const patchSchema = z.object({ expectedVersion: z.number().int().positive(), spec: z.unknown() });

export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readJsonBody(request);
	assertVersionPresent((body as { expectedVersion?: unknown })?.expectedVersion);
	const { expectedVersion, spec } = parseWith(patchSchema, body);
	return json(
		await getCmsContentStore().updateAiFeature({ id: params.id, expectedVersion, spec: parseFeatureSpec(spec) }),
	);
});
