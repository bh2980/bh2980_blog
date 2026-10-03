import { DEFAULT_ADMIN_PATH } from "../config/define";
import { cmsConfig } from "../config/resolved";

export { DEFAULT_ADMIN_PATH };

/** 관리자 화면 경로(`admin.path`, 기본 `/admin`). 앱의 관리자 라우트 폴더와 같아야 한다. */
export const ADMIN_PATH: string = cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH;

/** 설정을 읽지 않는 관리자 주소 규칙. `path`는 빈 글자·`/…`·`?…`다. */
export function adminHrefWith(base: string, path = ""): string {
	if (path !== "" && !path.startsWith("/") && !path.startsWith("?")) {
		throw new Error(`adminHref: "${path}" must start with "/" or "?"`);
	}
	return `${base}${path === "/" ? "" : path}`;
}

/**
 * 관리자 화면 안 주소. `adminHref()`는 목록(`/admin`), `adminHref("/media")`는 `/admin/media`,
 * `adminHref("?collection=post")`는 `/admin?collection=post`다. 경로는 `admin.path`를 따른다.
 */
export const adminHref = (path = ""): string => adminHrefWith(ADMIN_PATH, path);

/** 관리자 화면 안 글 편집 주소. */
export const adminEntryEditHref = (id: string): string => adminHref(`/entries/${id}/edit`);

/** 관리자 사이드바 `사이트 보기` 주소(`site.home`, 기본 `/`). */
export const SITE_HOME: string = cmsConfig.site?.home ?? "/";
