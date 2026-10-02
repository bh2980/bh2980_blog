import { updateAction } from "@bh2980/cms/ai/actions";
import { getCmsContentStore } from "@bh2980/cms/container";
import { z } from "zod";
import { adminRoute, assertVersionPresent, json, parseWith, readJsonBody } from "../../../handler";

type KeyParams = { key: string };

const patchSchema = z.object({ expectedVersion: z.number().int().min(0), value: z.unknown() });

/** 고칠 수 있는 값(켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사)을 저장한다. 기본값과 같은 값은 남기지 않는다. */
export const PATCH = adminRoute<KeyParams>(async ({ request, params }) => {
	const body = await readJsonBody(request);
	assertVersionPresent((body as { expectedVersion?: unknown })?.expectedVersion);
	const { expectedVersion, value } = parseWith(patchSchema, body);
	return json(await updateAction(getCmsContentStore(), params.key, expectedVersion, value));
});
