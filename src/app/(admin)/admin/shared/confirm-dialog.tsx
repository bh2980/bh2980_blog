"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
		<Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>{request?.title}</DialogTitle>
					<DialogDescription asChild={typeof request?.description !== "string"}>
						{typeof request?.description === "string" ? request.description : <div>{request?.description}</div>}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						취소
					</Button>
					<Button
						type="button"
						variant={request?.destructive ? "destructive" : "default"}
						onClick={() => {
							const action = request?.onConfirm;
							onClose();
							void action?.();
						}}
					>
						{request?.confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
