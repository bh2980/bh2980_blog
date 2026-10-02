"use client";

import type { Folder } from "@bh2980/cms/adapters/postgres/content-store";
import { COLLECTION_DEFINITIONS, isCollection } from "@bh2980/cms/core/collections";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cmsFetch, errorText } from "../admin-api";
import type { MenuAction } from "./action-menu";

type NameDialog = { mode: "create"; parentId: string | null } | { mode: "rename"; folder: Folder };

interface DeleteDialog {
	folder: Folder;
	contents: { entryCount: number; childFolders: Folder[] } | null;
}

/** `folder`와 그 자손을 뺀, 옮겨 갈 수 있는 부모 후보. 순환 구조는 서버도 거부한다(§3.3). */
export function moveTargetsFor(folder: Folder, folders: Folder[]): Folder[] {
	const blocked = new Set([folder.id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const candidate of folders) {
			if (candidate.parentId && blocked.has(candidate.parentId) && !blocked.has(candidate.id)) {
				blocked.add(candidate.id);
				grew = true;
			}
		}
	}
	return folders.filter((candidate) => !blocked.has(candidate.id) && candidate.id !== folder.parentId);
}

/**
 * 폴더의 오른쪽 클릭·`⋯` 메뉴. 사이드바 트리와 목록의 폴더 줄이 같은 메뉴를 쓴다.
 * 이동 대상은 자기 자신과 자손을 뺀 폴더다.
 */
export function folderMenuActions(folder: Folder, folders: Folder[], actions: FolderActions): MenuAction[] {
	const targets = moveTargetsFor(folder, folders);
	return [
		{ kind: "item", label: "새 하위 폴더", onSelect: () => actions.requestCreate(folder.id) },
		{ kind: "item", label: "이름 변경", shortcut: "F2", onSelect: () => actions.requestRename(folder) },
		{
			kind: "sub",
			label: "이동",
			emptyLabel: "옮길 수 있는 폴더가 없습니다",
			items: [
				...(folder.parentId
					? [{ kind: "item" as const, label: "최상위", onSelect: () => void actions.moveFolder(folder, null) }]
					: []),
				...targets.map((target) => ({
					kind: "item" as const,
					label: target.name,
					onSelect: () => void actions.moveFolder(folder, target.id),
				})),
			],
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: "삭제",
			shortcut: "Del",
			destructive: true,
			onSelect: () => void actions.requestDelete(folder),
		},
	];
}

/**
 * 가상 폴더 생성·이름 변경·이동·삭제(§3.3). 사이드바 트리와 목록의 폴더 행이 같은 상태와 대화상자를 쓴다.
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
	const restoreFocus = () => {
		const target = returnFocusRef.current;
		returnFocusRef.current = null;
		return target?.isConnected ? target : true;
	};

	const itemLabel = isCollection(collection) ? COLLECTION_DEFINITIONS[collection].label : "글";
	const folderName = (id: string | null) =>
		id ? `'${folders.find((f) => f.id === id)?.name ?? "상위 폴더"}'` : `'${itemLabel}' 최상위`;
	/** 옮겨 갈 곳 + 조사. 폴더 이름은 받침을 알 수 없어 `(으)로`를 붙인다. */
	const toFolder = (id: string | null) => (id ? `${folderName(id)}(으)로` : `${folderName(id)}로`);

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

	/** 폴더를 다른 부모(또는 최상위)로 옮긴다. 같은 이름이 있으면 서버가 거부하고 안내한다. */
	const moveFolder = async (folder: Folder, parentId: string | null) => {
		try {
			await cmsFetch(`/api/cms/v1/folders/${folder.id}`, {
				method: "PATCH",
				json: { parentId, expectedVersion: folder.version },
				fallback: "폴더를 옮기지 못했습니다.",
			});
			toast.success(`'${folder.name}' 폴더를 ${toFolder(parentId)} 옮겼습니다.`);
			await onChanged();
		} catch (err) {
			toast.error(errorText(err, "폴더를 옮기지 못했습니다."));
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
			const moved = deleteDialog.contents;
			toast.success(
				`'${deleteDialog.folder.name}' 폴더를 지웠습니다.${
					moved && moved.entryCount + moved.childFolders.length > 0
						? ` 안의 내용은 ${toFolder(deleteDialog.folder.parentId)} 옮겼습니다.`
						: ""
				}`,
			);
			setDeleteDialog(null);
			await onChanged(deletedId);
		} catch (err) {
			// 자식 폴더 이름이 부모에서 겹치면 먼저 이름을 바꾸도록 안내한다(§3.3).
			setError(errorText(err, "폴더를 삭제하지 못했습니다."));
		} finally {
			setIsBusy(false);
		}
	};

	const destination = deleteDialog ? toFolder(deleteDialog.folder.parentId) : "";

	const dialogs = (
		<>
			<Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
				<DialogContent className="max-w-sm" finalFocus={restoreFocus}>
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
						className="space-y-4"
					>
						<Field data-invalid={Boolean(error) || undefined}>
							<FieldLabel htmlFor="folder-name" className="sr-only">
								폴더 이름
							</FieldLabel>
							<Input
								id="folder-name"
								autoFocus
								value={name}
								maxLength={100}
								aria-invalid={Boolean(error) || undefined}
								onChange={(e) => setName(e.target.value)}
							/>
							{error && <FieldError>{error}</FieldError>}
						</Field>
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

			<AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
				<AlertDialogContent finalFocus={restoreFocus}>
					<AlertDialogHeader>
						<AlertDialogTitle>&apos;{deleteDialog?.folder.name}&apos; 폴더 삭제</AlertDialogTitle>
						<AlertDialogDescription>
							폴더만 지웁니다. 안의 {itemLabel}·하위 폴더는 휴지통으로 가지 않고 {destination} 옮겨집니다.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteDialog?.contents ? (
						<ul className="list-disc space-y-1 pl-5 text-sm">
							<li>
								바로 든 {itemLabel} {deleteDialog.contents.entryCount}개
							</li>
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
					<AlertDialogFooter>
						<AlertDialogCancel type="button">취소</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							disabled={!deleteDialog?.contents || isBusy}
							onClick={() => void confirmDelete()}
						>
							삭제
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);

	return { requestCreate, requestRename, requestDelete, moveFolder, dialogs };
}

export type FolderActions = Pick<
	ReturnType<typeof useFolderActions>,
	"requestCreate" | "requestRename" | "requestDelete" | "moveFolder"
>;
