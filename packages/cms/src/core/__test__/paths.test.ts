import { describe, expect, it } from "vitest";
import { cmsConfig } from "../../config/resolved";
import {
	ADMIN_PATH,
	adminEntryEditHref,
	adminHref,
	adminHrefWith,
	DEFAULT_ADMIN_PATH,
	SITE_HOME,
} from "../admin-paths";
import { previewHrefWith } from "../links";
import { DEFAULT_LOCALE, LOCALES, localePrefix, localePrefixFor, localizePath, localizePathWith } from "../locales";

describe("관리자 주소(admin.path)", () => {
	it("설정한 관리자 경로 아래 주소를 만든다", () => {
		expect(adminHrefWith("/studio")).toBe("/studio");
		expect(adminHrefWith("/studio", "/")).toBe("/studio");
		expect(adminHrefWith("/studio", "/media")).toBe("/studio/media");
		expect(adminHrefWith("/cms/admin", "?collection=post")).toBe("/cms/admin?collection=post");
		expect(() => adminHrefWith("/admin", "media")).toThrow(/must start with/);
	});

	it("사이트 설정을 따른다(없으면 /admin, 사이트 보기는 /)", () => {
		expect(ADMIN_PATH).toBe(cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH);
		expect(adminHref()).toBe(ADMIN_PATH);
		expect(adminHref("/login")).toBe(`${ADMIN_PATH}/login`);
		expect(adminEntryEditHref("e1")).toBe(`${ADMIN_PATH}/entries/e1/edit`);
		expect(SITE_HOME).toBe(cmsConfig.site?.home ?? "/");
	});
});

describe("언어 주소(site.localePrefix)", () => {
	it("방식마다 접두사가 다르다", () => {
		expect(localePrefixFor("ko", "except-default", "ko")).toBe("");
		expect(localePrefixFor("en", "except-default", "ko")).toBe("/en");
		expect(localePrefixFor("ko", "always", "ko")).toBe("/ko");
		expect(localePrefixFor("en", "never", "ko")).toBe("");
		expect(localizePathWith("/en", "/")).toBe("/en");
		expect(localizePathWith("/en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePathWith("", "/posts/a")).toBe("/posts/a");
	});

	it("사이트 설정을 따르고, 모르는 언어에는 붙이지 않는다", () => {
		const mode = cmsConfig.site?.localePrefix ?? "except-default";
		for (const locale of LOCALES) {
			expect(localePrefix(locale)).toBe(localePrefixFor(locale, mode, DEFAULT_LOCALE));
			expect(localizePath(locale, "/a")).toBe(`${localePrefixFor(locale, mode, DEFAULT_LOCALE)}/a`);
		}
		expect(localePrefix("xx-unknown")).toBe("");
	});
});

describe("미리보기 주소의 언어(site.previewLocaleParam)", () => {
	const base = { previewPath: "/preview/", path: "/posts/a", defaultLocale: "ko" };
	it("기본은 기본 언어가 아닐 때 `?locale=`이다", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: "locale", localePrefix: "/en" })).toBe(
			"/preview/posts/a?locale=en",
		);
		expect(previewHrefWith({ ...base, locale: "ko", param: "locale", localePrefix: "" })).toBe("/preview/posts/a");
		expect(previewHrefWith({ ...base, locale: "en", param: "lang", localePrefix: "/en" })).toBe(
			"/preview/posts/a?lang=en",
		);
	});

	it("`false`면 언어 접두사를 경로에 넣는다", () => {
		expect(previewHrefWith({ ...base, locale: "en", param: false, localePrefix: "/en" })).toBe("/preview/en/posts/a");
		expect(previewHrefWith({ ...base, locale: "ko", param: false, localePrefix: "" })).toBe("/preview/posts/a");
	});
});
