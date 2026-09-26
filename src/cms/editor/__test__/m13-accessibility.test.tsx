import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "@/app/(admin)/admin/admin-sidebar";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { BlockHandleOverlay } from "../block-handle-overlay";
import { CmsImageNodeView } from "../image-node-view";
import { InternalLinkPopup } from "../internal-link-popup";
import { SLASH_COMMANDS } from "../slash-command";
import { SlashMenuPopup } from "../slash-menu-popup";

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		NodeViewWrapper: ({
			as = "figure",
			children,
			...props
		}: { as?: "figure"; children?: ReactNode } & Omit<ComponentProps<"figure">, "children">) =>
			react.createElement(as, props, children),
	};
});

afterEach(cleanup);

describe("M13 editor accessibility", () => {
	it("names image and block controls and exposes alignment state", () => {
		const updateAttributes = vi.fn();
		const deleteNode = vi.fn();
		const nodeViewProps = {
			node: {
				attrs: {
					src: "/test-image.png",
					alt: "A test image",
					width: "100%",
					align: "center",
					caption: "",
					mediaId: null,
				},
			},
			updateAttributes,
			deleteNode,
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...nodeViewProps} />
				<BlockHandleOverlay
					coords={{ top: 10, left: 10 }}
					onMoveUp={vi.fn()}
					onMoveDown={vi.fn()}
					onDuplicate={vi.fn()}
					onDelete={vi.fn()}
				/>
			</>,
		);

		expect(screen.getByRole("button", { name: "이미지 왼쪽 정렬" }).getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByRole("button", { name: "이미지 가운데 정렬" }).getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "이미지 왼쪽 정렬" }));
		expect(updateAttributes).toHaveBeenCalledWith({ align: "left" });
		fireEvent.click(screen.getByRole("button", { name: "이미지 삭제" }));
		expect(deleteNode).toHaveBeenCalledOnce();

		const blockMenu = screen.getByRole("button", { name: "블록 조작 메뉴" });
		expect(blockMenu.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(blockMenu);
		expect(blockMenu.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("button", { name: /위로 이동/ })).toBeTruthy();
	});

	it("assigns unique IDs to each image editor field", () => {
		const props = {
			node: { attrs: { src: "/test-image.png", alt: "", width: "100%", align: "center", caption: "", mediaId: null } },
			updateAttributes: vi.fn(),
			deleteNode: vi.fn(),
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...props} />
				<CmsImageNodeView {...props} />
			</>,
		);

		for (const button of screen.getAllByRole("button", { name: /이미지 너비 설정/ })) fireEvent.click(button);

		const widthInputs = screen.getAllByLabelText("너비 (예: 100%, 600px)");
		const altInputs = screen.getAllByLabelText("대체 텍스트 (Alt)");
		expect(new Set(widthInputs.map((input) => input.id)).size).toBe(2);
		expect(new Set(altInputs.map((input) => input.id)).size).toBe(2);
	});

	it("keeps folder tree controls named and keyboard-expandable", () => {
		const onSelectFolder = vi.fn();
		const folders: Folder[] = [
			{ id: "folder-1", collection: "memo", parentId: null, name: "문서", position: 0, version: 1 },
			{ id: "folder-2", collection: "memo", parentId: "folder-1", name: "하위", position: 0, version: 1 },
			{ id: "folder-3", collection: "memo", parentId: "folder-2", name: "손자", position: 0, version: 1 },
		];
		render(
			<AdminSidebar
				currentCollection="memo"
				currentFolderId={null}
				folders={folders}
				onSelectFolder={onSelectFolder}
				onCreateFolder={vi.fn()}
				onRenameFolder={vi.fn()}
				onDeleteFolder={vi.fn()}
			/>,
		);

		const folder = screen.getByRole("button", { name: "문서" });
		expect(folder.getAttribute("aria-expanded")).toBe("false");
		fireEvent.keyDown(folder, { key: "Enter" });
		expect(onSelectFolder).toHaveBeenCalledWith("folder-1");
		expect(folder.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("button", { name: "하위 하위 폴더 펼치기" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "문서 하위 폴더 추가" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "폴더 이름 변경: 문서" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "폴더 삭제: 문서" })).toBeTruthy();
	});

	it("returns focus to the folder action after dismissing its dialog", async () => {
		const folder: Folder = {
			id: "folder-1",
			collection: "memo",
			parentId: null,
			name: "문서",
			position: 0,
			version: 1,
		};
		render(
			<AdminSidebar
				currentCollection="memo"
				currentFolderId={null}
				folders={[folder]}
				onSelectFolder={vi.fn()}
				onCreateFolder={vi.fn()}
				onRenameFolder={vi.fn()}
				onDeleteFolder={vi.fn()}
			/>,
		);

		const trigger = screen.getByRole("button", { name: "폴더 삭제: 문서" });
		trigger.focus();
		fireEvent.click(trigger);
		let dialog = await screen.findByRole("dialog", { name: "폴더 삭제 확인" });
		expect(dialog.contains(document.activeElement)).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "취소" }));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "폴더 삭제 확인" })).toBeNull());
		expect(document.activeElement).toBe(trigger);

		fireEvent.click(trigger);
		dialog = await screen.findByRole("dialog", { name: "폴더 삭제 확인" });
		expect(dialog.contains(document.activeElement)).toBe(true);
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "폴더 삭제 확인" })).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});

	it("falls back to the folder tree when deleting removes the trigger", async () => {
		const folder: Folder = {
			id: "folder-1",
			collection: "memo",
			parentId: null,
			name: "문서",
			position: 0,
			version: 1,
		};
		function SidebarWithRemovableFolder() {
			const [folders, setFolders] = useState([folder]);
			return (
				<AdminSidebar
					currentCollection="memo"
					currentFolderId={null}
					folders={folders}
					onSelectFolder={vi.fn()}
					onCreateFolder={vi.fn()}
					onRenameFolder={vi.fn()}
					onDeleteFolder={async () => setFolders([])}
				/>
			);
		}
		render(<SidebarWithRemovableFolder />);
		const trigger = screen.getByRole("button", { name: "폴더 삭제: 문서" });
		trigger.focus();
		fireEvent.click(trigger);
		const dialog = await screen.findByRole("dialog", { name: "폴더 삭제 확인" });
		expect(dialog.contains(document.activeElement)).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "폴더 삭제 확인" })).toBeNull());
		expect(trigger.isConnected).toBe(false);
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "폴더 트리" }));
	});

	it("lets keyboard-focused suggestions activate and close", async () => {
		const onSelectSlash = vi.fn();
		const onCloseSlash = vi.fn();
		render(
			<SlashMenuPopup
				items={[SLASH_COMMANDS[0]]}
				coords={{ top: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectSlash}
				onClose={onCloseSlash}
			/>,
		);
		const slashOption = await screen.findByRole("button", { name: /문단 \(Paragraph\)/ });
		fireEvent.mouseDown(slashOption);
		expect(onSelectSlash).not.toHaveBeenCalled();
		fireEvent.click(slashOption);
		expect(onSelectSlash).toHaveBeenCalledOnce();
		fireEvent.keyDown(slashOption, { key: "Escape" });
		expect(onCloseSlash).toHaveBeenCalledOnce();

		const onSelectLink = vi.fn();
		const onCloseLink = vi.fn();
		render(
			<InternalLinkPopup
				items={[{ id: "entry-1", collection: "post", title: "테스트 글", slug: "test-post" }]}
				isLoading={false}
				coords={{ top: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectLink}
				onClose={onCloseLink}
			/>,
		);
		const linkOption = screen.getByRole("button", { name: /테스트 글/ });
		fireEvent.mouseDown(linkOption);
		expect(onSelectLink).not.toHaveBeenCalled();
		fireEvent.click(linkOption);
		expect(onSelectLink).toHaveBeenCalledOnce();
		fireEvent.keyDown(linkOption, { key: "Escape" });
		expect(onCloseLink).toHaveBeenCalledOnce();
	});
});
