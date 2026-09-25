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
};

export function cmsApiIssues(payload: unknown): CmsIssue[] {
	if (!payload || typeof payload !== "object") return [];
	const issues = (payload as { issues?: unknown }).issues;
	return Array.isArray(issues)
		? issues.filter((issue): issue is CmsIssue => Boolean(issue && typeof issue === "object"))
		: [];
}

export function cmsIssueMessage(issue: CmsIssue): string {
	const label = (issue.code && ISSUE_LABELS[issue.code]) || issue.message || issue.code || "발행 검증 실패";
	const location = issue.position ? `${issue.position.line}행 ${issue.position.column}열` : issue.path;
	return location ? `${label} (${location})` : label;
}

export function cmsApiErrorMessage(payload: unknown, fallback: string): string {
	if (!payload || typeof payload !== "object") return fallback;
	const body = payload as { message?: unknown };
	const issues = cmsApiIssues(payload);
	if (issues.length > 0) {
		const details = issues.map(cmsIssueMessage);
		return `발행 검증 실패:\n${details.map((detail) => `• ${detail}`).join("\n")}`;
	}
	return typeof body.message === "string" && body.message ? body.message : fallback;
}
