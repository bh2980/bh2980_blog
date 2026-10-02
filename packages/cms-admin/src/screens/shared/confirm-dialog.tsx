"use client";

import type { ReactNode } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../ui/alert-dialog";

export interface ConfirmRequest {
	title: string;
	description: ReactNode;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void | Promise<void>;
}

/** 되돌리기 어려운 작업의 확인창. 취소하면 포커스는 여는 버튼으로 돌아간다. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
	return (
		<AlertDialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{request?.title}</AlertDialogTitle>
					<AlertDialogDescription render={typeof request?.description === "string" ? undefined : <div />}>
						{request?.description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel type="button">취소</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						variant={request?.destructive ? "destructive" : "default"}
						onClick={() => {
							const action = request?.onConfirm;
							onClose();
							void action?.();
						}}
					>
						{request?.confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
