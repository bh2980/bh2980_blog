"use client";

import { useRef, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cmsFetch, errorText } from "../admin-api";

type NameDialog = { mode: "create"; parentId: string | null } | { mode: "rename"; folder: Folder };

interface DeleteDialog {
	folder: Folder;
	contents: { entryCount: number; childFolders: Folder[] } | null;
}

/**
 * 가상 폴더 생성·이름 변경·삭제(§3.3). 사이드바 트리와 목록의 폴더 행이 같은 상태와 대화상자를 쓴다.
 * 삭제는 내용물을 미리 보여 준 뒤 진행한다. 직접 속한 글과 자식 폴더는 부모로 옮기고 글은 삭제하지 않는다.
 */
export function useFolderActions({
	collection,
	folders,
	onChanged,
}: {
	collection: string;
	folders: Folder[];
	onChanged: (deletedId?: string) => Promise<void> | void;
}) {
	const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	// 대화상자를 닫으면 연 버튼으로 초점을 돌려준다. 그 버튼이 사라졌으면(삭제된 폴더) 브라우저 기본값을 따른다.
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const rememberFocus = () => {
		returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	};
	const restoreFocus = (event: Event) => {
		const target = returnFocusRef.current;
		returnFocusRef.current = null;
		if (target?.isConnected) {
			event.preventDefault();
			target.focus();
		}
	};

	const folderName = (id: string | null) => (id ? (folders.find((f) => f.id === id)?.name ?? "상위 폴더") : "최상위");

	const requestCreate = (parentId: string | null) => {
		rememberFocus();
		setError(null);
		setName("");
		setNameDialog({ mode: "create", parentId });
	};

	const requestRename = (folder: Folder) => {
		rememberFocus();
		setError(null);
		setName(folder.name);
		setNameDialog({ mode: "rename", folder });
	};

	const requestDelete = async (folder: Folder) => {
		rememberFocus();
		setError(null);
		setDeleteDialog({ folder, contents: null });
		try {
			const contents = await cmsFetch<DeleteDialog["contents"]>(`/api/cms/v1/folders/${folder.id}`);
			setDeleteDialog({ folder, contents });
		} catch (err) {
			setError(errorText(err, "폴더 내용을 확인하지 못했습니다."));
		}
	};

	const submitName = async () => {
		if (!nameDialog || !name.trim()) return;
		setIsBusy(true);
		setError(null);
		try {
			if (nameDialog.mode === "create") {
				await cmsFetch("/api/cms/v1/folders", {
					method: "POST",
					json: { collection, name: name.trim(), parentId: nameDialog.parentId },
					fallback: "폴더를 만들지 못했습니다.",
				});
			} else {
				await cmsFetch(`/api/cms/v1/folders/${nameDialog.folder.id}`, {
					method: "PATCH",
					json: { name: name.trim(), expectedVersion: nameDialog.folder.version },
					fallback: "폴더 이름을 바꾸지 못했습니다.",
				});
			}
			setNameDialog(null);
			await onChanged();
		} catch (err) {
			setError(errorText(err, "폴더를 저장하지 못했습니다."));
		} finally {
			setIsBusy(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteDialog) return;
		setIsBusy(true);
		setError(null);
		try {
			await cmsFetch(`/api/cms/v1/folders/${deleteDialog.folder.id}?expectedVersion=${deleteDialog.folder.version}`, {
				method: "DELETE",
				fallback: "폴더를 삭제하지 못했습니다.",
			});
			const deletedId = deleteDialog.folder.id;
			setDeleteDialog(null);
			await onChanged(deletedId);
		} catch (err) {
			// 자식 폴더 이름이 부모에서 겹치면 먼저 이름을 바꾸도록 안내한다(§3.3).
			setError(errorText(err, "폴더를 삭제하지 못했습니다."));
		} finally {
			setIsBusy(false);
		}
	};

	const destination = deleteDialog ? folderName(deleteDialog.folder.parentId) : "";

	const dialogs = (
		<>
			<Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
				<DialogContent className="max-w-sm" onCloseAutoFocus={restoreFocus}>
					<DialogHeader>
						<DialogTitle>{nameDialog?.mode === "rename" ? "폴더 이름 변경" : "새 폴더"}</DialogTitle>
						<DialogDescription>
							{nameDialog?.mode === "create"
								? `위치: ${folderName(nameDialog.parentId)}. 폴더는 관리자 전용 분류이며 글 주소에 영향이 없습니다.`
								: "같은 위치에 같은 이름의 폴더는 둘 수 없습니다."}
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void submitName();
						}}
						className="space-y-2"
					>
						<label htmlFor="folder-name" className="sr-only">
							폴더 이름
						</label>
						<Input id="folder-name" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
						{error && (
							<p role="alert" className="text-destructive text-sm">
								{error}
							</p>
						)}
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setNameDialog(null)}>
								취소
							</Button>
							<Button type="submit" disabled={!name.trim() || isBusy}>
								{nameDialog?.mode === "rename" ? "이름 변경" : "만들기"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
				<DialogContent className="max-w-sm" onCloseAutoFocus={restoreFocus}>
					<DialogHeader>
						<DialogTitle>&apos;{deleteDialog?.folder.name}&apos; 폴더 삭제</DialogTitle>
						<DialogDescription>
							글은 삭제하지 않습니다. 폴더 안의 내용은 {destination}(으)로 옮겨집니다.
						</DialogDescription>
					</DialogHeader>
					{deleteDialog?.contents ? (
						<ul className="list-disc space-y-1 pl-5 text-sm">
							<li>직접 속한 글 {deleteDialog.contents.entryCount}개</li>
							<li>
								하위 폴더 {deleteDialog.contents.childFolders.length}개
								{deleteDialog.contents.childFolders.length > 0 &&
									`: ${deleteDialog.contents.childFolders.map((folder) => folder.name).join(", ")}`}
							</li>
						</ul>
					) : (
						!error && <p className="text-muted-foreground text-sm">내용을 확인하는 중…</p>
					)}
					{error && (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setDeleteDialog(null)}>
							취소
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={!deleteDialog?.contents || isBusy}
							onClick={() => void confirmDelete()}
						>
							삭제
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);

	return { requestCreate, requestRename, requestDelete, dialogs };
}

export type FolderActions = Pick<
	ReturnType<typeof useFolderActions>,
	"requestCreate" | "requestRename" | "requestDelete"
>;
