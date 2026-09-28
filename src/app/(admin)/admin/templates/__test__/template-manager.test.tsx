import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateManager } from "../template-manager";

vi.mock("@/cms/editor/tiptap-editor", () => ({ CmsEditor: () => null }));
vi.mock("../admin-sidebar", () => ({ AdminSidebar: () => null }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("TemplateManager", () => {
	it("loads templates from the API items envelope", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					items: [
						{
							id: "template-post-default",
							name: "일반 게시글",
							mdx: "## 개요",
							version: 1,
							createdAt: "2026-01-01T00:00:00.000Z",
							updatedAt: "2026-01-01T00:00:00.000Z",
						},
					],
				}),
			}),
		);

		render(<TemplateManager />);

		expect(await screen.findByText("일반 게시글")).toBeTruthy();
		expect(screen.getByText("총 1개")).toBeTruthy();
		expect(screen.queryByText("메모용")).toBeNull();
		expect(screen.queryByText("포스트용")).toBeNull();
	});
});
