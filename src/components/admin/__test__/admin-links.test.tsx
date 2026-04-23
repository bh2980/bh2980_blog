import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminEditLink, AdminHeaderLink } from "../admin-links";

describe("admin links", () => {
	it("권한이 없으면 헤더 관리자 링크를 렌더링하지 않는다", () => {
		render(<AdminHeaderLink canManage={false} />);
		expect(screen.queryByRole("link", { name: "관리자" })).toBeNull();
	});

	it("권한이 있으면 헤더 관리자 링크를 렌더링한다", () => {
		render(<AdminHeaderLink canManage />);
		const link = screen.getByRole("link", { name: "관리자" });
		expect(link.getAttribute("href")).toBe("/keystatic");
	});

	it("권한이 없으면 글 수정 링크를 렌더링하지 않는다", () => {
		render(<AdminEditLink canManage={false} collection="post" slug="기술-스택-선정하기" />);
		expect(screen.queryByRole("link", { name: "수정" })).toBeNull();
	});

	it("권한이 있으면 글 수정 링크를 렌더링한다", () => {
		render(<AdminEditLink canManage collection="post" slug="기술-스택-선정하기" />);
		const link = screen.getByRole("link", { name: "수정" });
		expect(link.getAttribute("href")).toBe(
			"/keystatic/branch/main/collection/post/item/%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EC%84%A0%EC%A0%95%ED%95%98%EA%B8%B0",
		);
	});

	it("권한이 있으면 메모 수정 링크를 렌더링한다", () => {
		render(<AdminEditLink canManage collection="memo" slug="1-implement-curry" />);
		const link = screen.getByRole("link", { name: "수정" });
		expect(link.getAttribute("href")).toBe("/keystatic/branch/main/collection/memo/item/1-implement-curry");
	});

	it("local mode면 수정 링크에서 branch를 제외한다", () => {
		render(<AdminEditLink canManage collection="post" slug="기술-스택-선정하기" mode="local" />);
		const link = screen.getByRole("link", { name: "수정" });
		expect(link.getAttribute("href")).toBe(
			"/keystatic/collection/post/item/%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EC%84%A0%EC%A0%95%ED%95%98%EA%B8%B0",
		);
	});
});
