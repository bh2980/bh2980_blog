import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { AdminMobileNavigation } from "../admin-mobile-navigation";
import { AdminSidebar } from "../admin-sidebar";

describe("AdminMobileNavigation", () => {
	it("opens the Sheet and closes after navigation", async () => {
		render(
			<AdminMobileNavigation>
				{(close) => (
					<AdminSidebar activeNav="media" currentCollection="post" onSelectCollection={vi.fn()} onNavigate={close} />
				)}
			</AdminMobileNavigation>,
		);

		const trigger = screen.getByRole("button", { name: "관리자 메뉴 열기" });
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(trigger);

		const dialog = await screen.findByRole("dialog", { name: "관리자 메뉴" });
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "메모" }));

		await waitFor(() => expect(dialog.isConnected && !dialog.hasAttribute("data-closed")).toBe(false));
		await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
	});

	it.each(["Enter", " "])("keeps the Sheet open for nested folder key %j", async (key) => {
		const folders: Folder[] = [
			{ id: "parent", collection: "post", parentId: null, name: "상위", position: 0, version: 1 },
			{ id: "child", collection: "post", parentId: "parent", name: "하위", position: 0, version: 1 },
		];
		render(
			<AdminMobileNavigation>
				{(close) => (
					<AdminSidebar
						activeNav="post"
						currentCollection="post"
						folders={folders}
						onSelectFolder={vi.fn()}
						onSelectCollection={vi.fn()}
						onNavigate={close}
					/>
				)}
			</AdminMobileNavigation>,
		);

		fireEvent.click(screen.getByRole("button", { name: "관리자 메뉴 열기" }));
		const dialog = await screen.findByRole("dialog", { name: "관리자 메뉴" });
		const toggle = screen.getByRole("button", { name: "상위 하위 폴더 펼치기" });

		fireEvent.keyDown(toggle, { key });

		expect(dialog.hasAttribute("data-open")).toBe(true);
	});
});
