import type { NextRequest } from "next/server";
import * as r2 from "./v1/ai/actions/[key]/reset/route";
import * as r1 from "./v1/ai/actions/[key]/route";
import * as r0 from "./v1/ai/actions/route";
import * as r3 from "./v1/ai/models/route";
import * as r6 from "./v1/ai/providers/[id]/route";
import * as r5 from "./v1/ai/providers/check/route";
import * as r4 from "./v1/ai/providers/route";
import * as r7 from "./v1/ai/run/route";
import * as r8 from "./v1/ai/settings/route";
import * as r9 from "./v1/bulk/route";
import * as r12 from "./v1/entries/[id]/archive/route";
import * as r13 from "./v1/entries/[id]/duplicate/route";
import * as r14 from "./v1/entries/[id]/publish/route";
import * as r15 from "./v1/entries/[id]/relations/route";
import * as r16 from "./v1/entries/[id]/restore/route";
import * as r11 from "./v1/entries/[id]/route";
import * as r17 from "./v1/entries/[id]/schedule/route";
import * as r18 from "./v1/entries/[id]/translations/route";
import * as r19 from "./v1/entries/[id]/trash/route";
import * as r20 from "./v1/entries/[id]/unarchive/route";
import * as r10 from "./v1/entries/route";
import { HttpError, handleApiError } from "./v1/error-handler";
import * as r21 from "./v1/export/route";
import * as r23 from "./v1/folders/[id]/route";
import * as r22 from "./v1/folders/route";
import * as r28 from "./v1/media/[id]/complete/route";
import * as r27 from "./v1/media/[id]/route";
import * as r25 from "./v1/media/cleanup/route";
import * as r24 from "./v1/media/route";
import * as r26 from "./v1/media/uploads/route";
import * as r29 from "./v1/meta/route";
import * as r30 from "./v1/preferences/route";
import * as r32 from "./v1/schedules/[id]/publish/route";
import * as r31 from "./v1/schedules/due/route";
import * as r34 from "./v1/templates/[id]/route";
import * as r33 from "./v1/templates/route";

/**
 * 관리자 API(`/api/cms/v1/*`) 경로표. 앱은 catch-all 라우트 하나(`app/api/cms/[...path]/route.ts`)에서
 * `createCmsRouteHandler()`를 내보낸다. 경로 모양은 Next 라우트 폴더와 같다(`[id]`는 한 칸).
 */

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
/** 라우트 파일. 처리기의 매개변수 모양(`{ id }` 등)이 라우트마다 달라, 부를 때 `RouteHandler`로 본다. */
type RouteModule = Partial<Record<Method, unknown>>;

const ROUTES: ReadonlyArray<{ pattern: string; module: RouteModule }> = [
	{ pattern: "v1/ai/actions", module: r0 },
	{ pattern: "v1/ai/actions/[key]", module: r1 },
	{ pattern: "v1/ai/actions/[key]/reset", module: r2 },
	{ pattern: "v1/ai/models", module: r3 },
	{ pattern: "v1/ai/providers", module: r4 },
	{ pattern: "v1/ai/providers/check", module: r5 },
	{ pattern: "v1/ai/providers/[id]", module: r6 },
	{ pattern: "v1/ai/run", module: r7 },
	{ pattern: "v1/ai/settings", module: r8 },
	{ pattern: "v1/bulk", module: r9 },
	{ pattern: "v1/entries", module: r10 },
	{ pattern: "v1/entries/[id]", module: r11 },
	{ pattern: "v1/entries/[id]/archive", module: r12 },
	{ pattern: "v1/entries/[id]/duplicate", module: r13 },
	{ pattern: "v1/entries/[id]/publish", module: r14 },
	{ pattern: "v1/entries/[id]/relations", module: r15 },
	{ pattern: "v1/entries/[id]/restore", module: r16 },
	{ pattern: "v1/entries/[id]/schedule", module: r17 },
	{ pattern: "v1/entries/[id]/translations", module: r18 },
	{ pattern: "v1/entries/[id]/trash", module: r19 },
	{ pattern: "v1/entries/[id]/unarchive", module: r20 },
	{ pattern: "v1/export", module: r21 },
	{ pattern: "v1/folders", module: r22 },
	{ pattern: "v1/folders/[id]", module: r23 },
	{ pattern: "v1/media", module: r24 },
	{ pattern: "v1/media/cleanup", module: r25 },
	{ pattern: "v1/media/uploads", module: r26 },
	{ pattern: "v1/media/[id]", module: r27 },
	{ pattern: "v1/media/[id]/complete", module: r28 },
	{ pattern: "v1/meta", module: r29 },
	{ pattern: "v1/preferences", module: r30 },
	{ pattern: "v1/schedules/due", module: r31 },
	{ pattern: "v1/schedules/[id]/publish", module: r32 },
	{ pattern: "v1/templates", module: r33 },
	{ pattern: "v1/templates/[id]", module: r34 },
];

const COMPILED = ROUTES.map(({ pattern, module }) => ({ segments: pattern.split("/"), module }));

/** 경로 조각과 맞는 라우트와 매개변수. 이름 있는 조각이 `[이름]` 조각보다 먼저 맞는다(표 순서). */
export function matchRoute(path: readonly string[]): { module: RouteModule; params: Record<string, string> } | null {
	for (const { segments, module } of COMPILED) {
		if (segments.length !== path.length) continue;
		const params: Record<string, string> = {};
		const matched = segments.every((segment, index) => {
			const part = path[index] ?? "";
			if (segment.startsWith("[") && segment.endsWith("]")) {
				params[segment.slice(1, -1)] = part;
				return part !== "";
			}
			return segment === part;
		});
		if (matched) return { module, params };
	}
	return null;
}

/** 등록된 관리자 API 경로(문서·테스트용). */
export const CMS_ROUTE_PATTERNS: readonly string[] = ROUTES.map((route) => route.pattern);

const notFound = () => handleApiError(new HttpError(404, "not_found", "Unknown CMS API path"));

/**
 * catch-all 라우트 처리기. `params.path`는 `/api/cms/` 뒤의 경로 조각이다(예: `["v1", "entries", "<id>"]`).
 * 없는 경로는 404, 경로는 있지만 그 메서드가 없으면 405다.
 */
export type CmsRouteHandler = (
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
) => Promise<Response>;

export function createCmsRouteHandler(): Record<Method, CmsRouteHandler> {
	const handle =
		(method: Method): CmsRouteHandler =>
		async (request, context) => {
			const { path = [] } = await context.params;
			const matched = matchRoute(path);
			if (!matched) return notFound();
			const handler = matched.module[method] as RouteHandler | undefined;
			if (!handler) {
				return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
			}
			return handler(request, { params: Promise.resolve(matched.params) });
		};
	return {
		GET: handle("GET"),
		POST: handle("POST"),
		PATCH: handle("PATCH"),
		PUT: handle("PUT"),
		DELETE: handle("DELETE"),
	};
}
