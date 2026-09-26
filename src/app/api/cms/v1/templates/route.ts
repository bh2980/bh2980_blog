import { getCmsContentStore } from "@/cms/container";
import { createTemplateBodySchema, templateCollectionSchema } from "@/cms/core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

export const GET = adminRoute(async ({ request }) => {
	const raw = request.nextUrl.searchParams.get("forCollection");
	const forCollection = raw
		? parseWith(templateCollectionSchema, raw, "Invalid forCollection query parameter")
		: undefined;
	return json({ items: await getCmsContentStore().listTemplates({ forCollection }) });
});

export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(createTemplateBodySchema, await readJsonBody(request));
	return json(await getCmsContentStore().createTemplate(body), { status: 201 });
});
