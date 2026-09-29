export type CmsIssue = {
	code?: string;
	message?: string;
	path?: string;
	position?: { line: number; column: number };
};

const ISSUE_LABELS: Record<string, string> = {
	null_slug: "주소(slug)를 입력하세요.",
	missing_title: "제목을 입력하세요.",
	empty_body: "본문을 입력하세요.",
	missing_category: "공개된 카테고리를 지정하세요.",
	unresolved_reference: "참조 항목을 찾을 수 없습니다.",
	unresolved_media: "이미지 미디어를 찾을 수 없습니다.",
	unpublished_reference: "참조 항목이 공개 상태가 아닙니다.",
	invalid_reference_collection: "참조 항목의 종류가 올바르지 않습니다.",
	invalid_item_collection: "모음집에는 게시글만 추가할 수 있습니다.",
	unresolved_internal_link: "해결할 수 없는 내부 링크가 있습니다.",
	unpublished_internal_link: "아직 공개되지 않은 항목을 가리키는 내부 링크가 있습니다.",
	mdx_error: "MDX 본문 구문을 확인하세요.",
	frontmatter_present: "본문 안에 frontmatter를 넣을 수 없습니다.",
	image_src_not_allowed: "허용되지 않는 이미지 주소입니다.",
	image_media_not_ready: "이미지가 아직 준비되지 않았습니다.",
	image_media_unresolved: "이미지를 찾을 수 없습니다.",
	image_media_missing_in_storage: "이미지 파일을 저장소에서 찾을 수 없습니다.",
	missing_block_attribute: "블록의 필수 속성이 비어 있습니다.",
	invalid_block_attribute: "블록 속성 값이 올바르지 않습니다.",
	unknown_block_attribute: "정의되지 않은 블록 속성이 있습니다.",
	missing_image_alt: "이미지 대체 텍스트를 입력하거나 장식 이미지로 표시하세요.",
	future_published_at: "미래 시각은 발행일로 지정할 수 없습니다. 예약 기능을 사용하세요.",
	missing_media_id: "이미지 주소(mediaId 또는 src)가 없습니다.",
	invalid_reference_id: "미디어 ID 형식이 올바르지 않습니다.",
	dynamic_reference_id: "미디어 ID는 문자열이어야 합니다.",
	missing_field: "필수 항목을 입력하세요.",
	source_not_published: "원문을 먼저 발행하세요. 번역본의 카테고리·태그·발행일은 원문 공개본에서 옵니다.",
	untranslated_text: "번역하지 않은 글이 남아 있습니다.",
};

/** API 오류 `code`의 안내 문구(§10.1). 응답 `message`보다 이 문구를 먼저 보여 준다. */
const ERROR_LABELS: Record<string, string> = {
	conflict: "다른 곳에서 먼저 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도하세요.",
	slug_conflict: "이미 쓰이고 있는 주소(slug)입니다.",
	translation_exists: "이 언어의 번역본이 이미 있습니다(휴지통 포함).",
	has_translations: "휴지통 밖에 번역본이 남아 있습니다. 번역본도 휴지통으로 옮긴 뒤 지우세요.",
	source_trashed: "원문이 휴지통에 있습니다. 원문을 먼저 복원하세요.",
	in_use: "다른 콘텐츠가 사용 중이라 진행할 수 없습니다. 사용처를 먼저 정리하세요.",
	invalid_status: "현재 상태에서는 할 수 없는 작업입니다.",
	locked: "예약된 글입니다. 예약을 해제한 뒤 편집하세요.",
	folder_name_conflict: "같은 위치에 같은 이름의 폴더가 있습니다. 이름을 바꾼 뒤 다시 시도하세요.",
	version_required: "버전 정보가 없습니다. 화면을 새로고침하세요.",
	unauthorized: "로그인이 만료되었습니다. 다시 로그인하세요.",
	forbidden: "권한이 없습니다.",
	unsupported_media_type: "허용되지 않는 파일 형식입니다.",
	payload_too_large: "파일이 너무 큽니다.",
	too_many_pixels: "이미지 해상도가 너무 큽니다(최대 4천만 픽셀).",
	unavailable: "저장소에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도하세요.",
};

export function cmsApiIssues(payload: unknown): CmsIssue[] {
	if (!payload || typeof payload !== "object") return [];
	const issues = (payload as { issues?: unknown }).issues;
	return Array.isArray(issues)
		? issues.filter((issue): issue is CmsIssue => Boolean(issue && typeof issue === "object"))
		: [];
}

/** 이슈의 `message`가 대상(속성 이름·주소·파서 오류)을 알려 주는 코드. 안내 문구 뒤에 붙인다. */
const DETAILED_CODES = new Set([
	"untranslated_text",
	"mdx_error",
	"missing_block_attribute",
	"invalid_block_attribute",
	"unknown_block_attribute",
	"unresolved_internal_link",
	"unpublished_internal_link",
	"image_src_not_allowed",
]);

export function cmsIssueMessage(issue: CmsIssue): string {
	const known = issue.code ? ISSUE_LABELS[issue.code] : undefined;
	const detail = known && issue.code && DETAILED_CODES.has(issue.code) && issue.message ? ` — ${issue.message}` : "";
	const label = known ? `${known}${detail}` : issue.message || issue.code || "발행 검증 실패";
	const location = issue.position ? `${issue.position.line}행 ${issue.position.column}열` : issue.path;
	return location ? `${label} (${location})` : label;
}

export function cmsApiErrorMessage(payload: unknown, fallback: string): string {
	if (!payload || typeof payload !== "object") return fallback;
	const body = payload as { message?: unknown; code?: unknown };
	const issues = cmsApiIssues(payload);
	if (issues.length > 0) {
		const details = issues.map(cmsIssueMessage);
		return `발행 검증 실패:\n${details.map((detail) => `• ${detail}`).join("\n")}`;
	}
	if (typeof body.code === "string" && ERROR_LABELS[body.code]) return ERROR_LABELS[body.code];
	return typeof body.message === "string" && body.message ? body.message : fallback;
}
