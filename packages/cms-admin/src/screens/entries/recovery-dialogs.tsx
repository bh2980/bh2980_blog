"use client";

import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { useConfirm } from "../shared/confirm-dialog";
import { type EntryData, type EntryForm, formFromEntry } from "./entry-form";
import type { LocalBackupRecord } from "./local-backup";

/** 편집 화면을 열 때 찾은 브라우저 복구본. 그 뒤 서버도 바뀌었으면 `conflict`다(§5.1). */
export type Recovery =
	| { kind: "restore"; backup: LocalBackupRecord<EntryForm> }
	| { kind: "conflict"; backup: LocalBackupRecord<EntryForm>; server: EntryData };

/** 서버에 없는 브라우저 임시 저장본을 불러올지 묻는다. */
export function RecoveryDialog({
	recovery,
	onClose,
	onKeepServer,
	onRestore,
}: {
	recovery: Recovery | null;
	onClose: () => void;
	onKeepServer: (recovery: Recovery) => void;
	onRestore: (recovery: Recovery) => void;
}) {
	return (
		<Dialog open={recovery !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>저장하지 않은 편집이 있습니다</DialogTitle>
					<DialogDescription>
						{recovery
							? `${new Date(recovery.backup.savedAt).toLocaleString("ko-KR")}에 이 브라우저에 임시 저장한 편집이 서버에 없습니다.`
							: ""}
						{recovery?.kind === "conflict" &&
							" 그 뒤 다른 곳에서 서버 내용도 바뀌었습니다. 임시 저장본을 불러와 저장하면 서버 내용을 덮어씁니다."}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => recovery && onKeepServer(recovery)}>
						서버 저장본 열기
					</Button>
					<Button type="button" onClick={() => recovery && onRestore(recovery)}>
						임시 저장본 불러오기
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** 자동 저장·발행 중 다른 곳에서 먼저 저장했을 때. 양쪽을 비교해 복사하거나 하나를 고른다. */
export function ConflictDialog({
	conflict,
	onClose,
	onReload,
	onOverwrite,
}: {
	conflict: { server: EntryData; local: EntryForm } | null;
	onClose: () => void;
	onReload: () => void;
	/** 서버 최신 버전 위에 내 입력을 덮어쓴다. */
	onOverwrite: (serverVersion: number) => void;
}) {
	const { confirm, dialog } = useConfirm();
	// 서버 최신본을 통째로 바꾸므로 한 번 더 묻는다(§5).
	const overwrite = async () => {
		if (!conflict) return;
		const serverVersion = conflict.server.version;
		if (
			await confirm({
				title: "덮어쓰기",
				description: "서버 최신본을 내 입력으로 덮어쓸까요? 다른 곳에서 저장한 변경은 사라집니다.",
				confirmLabel: "덮어쓰기",
				destructive: true,
			})
		) {
			onOverwrite(serverVersion);
		}
	};
	return (
		<Dialog open={conflict !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>편집 충돌</DialogTitle>
					<DialogDescription>
						다른 탭이나 기기에서 먼저 저장했습니다. 내 입력은 브라우저에 남아 있습니다. 양쪽을 비교해 복사하거나 하나를
						고르세요.
					</DialogDescription>
				</DialogHeader>
				{conflict && (
					<ComparePanes
						local={conflict.local}
						server={formFromEntry(conflict.server)}
						serverVersion={conflict.server.version}
					/>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						닫기
					</Button>
					<Button type="button" variant="outline" onClick={onReload}>
						다시 불러오기
					</Button>
					<Button type="button" variant="destructive" onClick={() => void overwrite()}>
						내 내용으로 덮어쓰기
					</Button>
				</DialogFooter>
				{dialog}
			</DialogContent>
		</Dialog>
	);
}

/** 충돌 화면의 양쪽 비교(§5.1 "양쪽 내용을 확인·복사"). */
function ComparePanes({
	local,
	server,
	serverVersion,
}: {
	local: EntryForm;
	server: EntryForm;
	serverVersion: number;
}) {
	const copy = async (mdx: string) => {
		try {
			await navigator.clipboard.writeText(mdx);
			toast.success("본문을 복사했습니다.");
		} catch {
			toast.error("복사하지 못했습니다.");
		}
	};
	const pane = (label: string, value: EntryForm) => (
		<div className="space-y-2 rounded border p-3">
			<p className="font-semibold text-sm">{label}</p>
			<p className="text-xs">
				제목: {value.title || "제목 없음"} · 주소: {value.slug || "없음"}
			</p>
			<Button type="button" variant="link" size="xs" className="px-0" onClick={() => void copy(value.mdx)}>
				본문 복사
			</Button>
			<pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{value.mdx}</pre>
		</div>
	);
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{pane("내 입력", local)}
			{pane(`서버 최신본 · v${serverVersion}`, server)}
		</div>
	);
}
