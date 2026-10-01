import "server-only";
import type { z } from "zod";
import { type AiFeatureSpec, aiFeatureSpecSchema } from "@/cms/ai/definition";
import { AiError } from "@/cms/ai/errors";
import type { AiOption, AiRunDeps } from "@/cms/ai/run";
import type { AiRuntime } from "@/cms/ai/settings";
import { siteImageUrl } from "@/cms/ai/site-image";
import { getCmsContentStore, getCmsMediaStore } from "@/cms/container";
import { isCollection } from "@/cms/core/collections";
import { schemaOf } from "@/cms/schema/derive";
import type { RelationTarget } from "@/cms/schema/fields";
import { HttpError } from "../error-handler";

/** 기능 정의를 검사한다. 오류는 발행 검증 모양(`issues`)이 아니라 첫 문제 한 줄로 알린다. */
export function parseFeatureSpec(value: unknown): AiFeatureSpec {
	const parsed = aiFeatureSpecSchema.safeParse(value);
	if (!parsed.success) {
		const issue = parsed.error.issues[0] as z.core.$ZodIssue | undefined;
		const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		throw new HttpError(400, "invalid_input", `${where}${issue?.message ?? "정의가 올바르지 않습니다."}`);
	}
	return parsed.data;
}

/** 멀티모달 모델이 흔히 받는 이미지 형식과 크기. */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 다른 컬렉션의 공개된 항목 전체(태그·카테고리·모음집·글). */
async function loadRecords(collection: RelationTarget): Promise<AiOption[]> {
	const store = getCmsContentStore();
	const options: AiOption[] = [];
	for (let page = 1; page <= 20; page++) {
		const result = await store.listEntries({
			collection,
			statuses: ["published"],
			sort: { field: "title", direction: "asc" },
			page,
			pageSize: 100,
		});
		options.push(...result.items.map((item) => ({ value: item.id, label: item.title || item.slug || item.id })));
		if (options.length >= result.total || result.items.length === 0) break;
	}
	return options;
}

/** 컬렉션 필드의 선택 목록(`select` 필드와 조건부 필드의 고르는 칸). */
function fieldOptions(collection: string, field: string): AiOption[] {
	if (!isCollection(collection)) return [];
	const definition = schemaOf(collection).fields[field];
	// 조건부 필드(정책 등)는 고르는 칸(discriminant)의 목록을 쓴다.
	const select = definition?.kind === "conditional" ? definition.discriminant : definition;
	return select?.kind === "select"
		? Object.entries(select.options).map(([value, label]) => ({ value, label: String(label) }))
		: [];
}

type LoadedImage = Awaited<ReturnType<AiRunDeps["loadImage"]>>;

async function fetchSiteImage(url: URL, signal?: AbortSignal): Promise<LoadedImage> {
	const response = await fetch(url, { signal, redirect: "error", cache: "no-store" }).catch(() => null);
	if (!response?.ok) return null;
	const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
	if (!IMAGE_TYPES.has(mimeType)) throw new AiError("ai_failed", "AI가 읽을 수 없는 이미지 형식입니다.");
	if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
		throw new AiError("ai_input_too_large", "이미지가 5MB를 넘어 보낼 수 없습니다.");
	}
	const bytes = await response.arrayBuffer();
	if (bytes.byteLength > MAX_IMAGE_BYTES)
		throw new AiError("ai_input_too_large", "이미지가 5MB를 넘어 보낼 수 없습니다.");
	return {
		mediaType: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
		data: Buffer.from(bytes).toString("base64"),
	};
}

/**
 * 실행기에 넘길 저장소 연결. 태그·카테고리·이미지·주소는 서버가 직접 읽는다.
 * `origin`은 이 사이트 주소다. 미디어 라이브러리 밖 이미지(사이트 파일)를 여기서 읽는다.
 */
export function aiRunDeps(runtime: AiRuntime, signal?: AbortSignal, origin?: string): AiRunDeps {
	const store = getCmsContentStore();
	return {
		...runtime,
		signal,
		loadRecords,
		fieldOptions,
		loadImage: async ({ mediaId, src }) => {
			if (!mediaId) {
				const url = src && origin ? siteImageUrl(src, origin) : null;
				if (!url) throw new AiError("ai_failed", "이 사이트의 이미지만 읽을 수 있습니다.");
				return fetchSiteImage(url, signal);
			}
			const media = await store.getMediaAsset(mediaId);
			if (!media || media.status !== "ready" || !media.storageKey) return null;
			if (!media.mimeType || !IMAGE_TYPES.has(media.mimeType)) {
				throw new AiError("ai_failed", "AI가 읽을 수 없는 이미지 형식입니다.");
			}
			if ((media.byteSize ?? 0) > MAX_IMAGE_BYTES) {
				throw new AiError("ai_input_too_large", "이미지가 5MB를 넘어 보낼 수 없습니다.");
			}
			const bytes = await getCmsMediaStore().readFile({ key: media.storageKey, maxBytes: MAX_IMAGE_BYTES, signal });
			return {
				mediaType: media.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
				data: Buffer.from(bytes).toString("base64"),
			};
		},
		takenSlugs: (params) => store.findTakenSlugs(params),
	};
}
