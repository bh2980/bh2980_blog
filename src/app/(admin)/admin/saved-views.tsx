"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { type AdminColumnSettings, MAX_SAVED_VIEWS, type SavedView } from "@/cms/core/api";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";

const sameColumns = (a?: AdminColumnSettings, b?: AdminColumnSettings) =>
	JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

const newViewId = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type NameDialog = { mode: "create" } | { mode: "rename"; view: SavedView };

/**
 * 이름 붙인 저장된 보기(v2 A4). 검색·필터·정렬·컬럼 설정을 저장하고 폴더는 담지 않는다.
 * 보기를 연 뒤 조건을 바꾸면 `변경됨`과 저장 버튼을 보여 준다.
 */
export function SavedViews({
	views,
	activeId,
	currentQuery,
	currentColumns,
	onOpen,
	onOpenAll,
	onChange,
}: {
	views: SavedView[];
	activeId: string;
	/** 지금 목록의 `viewQueryOf(state)`. */
	currentQuery: string;
	currentColumns?: AdminColumnSettings;
	onOpen: (view: SavedView) => void;
	onOpenAll: () => void;
	/** 보기 목록 전체를 저장한다. `openId`를 주면 저장 뒤 그 보기를 연 상태로 둔다. */
	onChange: (views: SavedView[], openId?: string) => void;
}) {
	const [dialog, setDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const active = views.find((view) => view.id === activeId);
	const modified = Boolean(active && (active.query !== currentQuery || !sameColumns(active.columns, currentColumns)));
	const atLimit = views.length >= MAX_SAVED_VIEWS;

	const openDialog = (next: NameDialog) => {
		setName(next.mode === "rename" ? next.view.name : "");
		setDialog(next);
	};

	const submit = () => {
		const trimmed = name.trim();
		if (!dialog || !trimmed) return;
		if (dialog.mode === "create") {
			const view: SavedView = { id: newViewId(), name: trimmed, query: currentQuery, columns: currentColumns };
			onChange([...views, view], view.id);
		} else {
			onChange(views.map((view) => (view.id === dialog.view.id ? { ...view, name: trimmed } : view)));
		}
		setDialog(null);
	};

	const move = (index: number, direction: -1 | 1) => {
		const next = [...views];
		const target = index + direction;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target] as SavedView, next[index] as SavedView];
		onChange(next);
	};

	const menuFor = (view: SavedView, index: number): MenuAction[] => [
		{ kind: "item", label: "열기", onSelect: () => onOpen(view) },
		{ kind: "item", label: "이름 변경", shortcut: "F2", onSelect: () => openDialog({ mode: "rename", view }) },
		{ kind: "item", label: "앞으로 옮기기", disabled: index === 0, onSelect: () => move(index, -1) },
		{ kind: "item", label: "뒤로 옮기기", disabled: index === views.length - 1, onSelect: () => move(index, 1) },
		{ kind: "separator" },
		{
			kind: "item",
			label: "삭제",
			destructive: true,
			onSelect: () => onChange(views.filter((item) => item.id !== view.id)),
		},
	];

	const tabClass = (on: boolean) =>
		cn(
			"h-7 rounded-md px-2.5 text-xs",
			on ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground",
		);

	return (
		<nav aria-label="저장된 보기" className="flex flex-wrap items-center gap-1">
			<Button
				type="button"
				variant="ghost"
				className={tabClass(!activeId)}
				aria-current={!activeId ? "true" : undefined}
				onClick={onOpenAll}
			>
				전체
			</Button>
			{views.map((view, index) => (
				<ActionContextMenu
					key={view.id}
					actions={menuFor(view, index)}
					trigger={
						<Button
							type="button"
							variant="ghost"
							className={tabClass(view.id === activeId)}
							aria-current={view.id === activeId ? "true" : undefined}
							onClick={() => onOpen(view)}
							onKeyDown={(event) => {
								if (event.key === "F2") {
									event.preventDefault();
									openDialog({ mode: "rename", view });
								}
							}}
						/>
					}
				>
					{view.name}
				</ActionContextMenu>
			))}
			{active && (
				<MoreActionsButton
					actions={menuFor(active, views.indexOf(active))}
					label={`'${active.name}' 보기 관리`}
					className="size-7"
				/>
			)}
			{modified && active ? (
				<span className="flex items-center gap-1 text-xs">
					<span className="text-muted-foreground">변경됨 ·</span>
					<Button
						type="button"
						variant="link"
						size="xs"
						className="px-0"
						onClick={() =>
							onChange(
								views.map((view) =>
									view.id === active.id ? { ...view, query: currentQuery, columns: currentColumns } : view,
								),
								active.id,
							)
						}
					>
						저장
					</Button>
					<span className="text-muted-foreground">/</span>
					<Button
						type="button"
						variant="link"
						size="xs"
						className="px-0"
						disabled={atLimit}
						onClick={() => openDialog({ mode: "create" })}
					>
						새 보기로 저장
					</Button>
				</span>
			) : (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="size-7"
					aria-label="현재 조건을 새 보기로 저장"
					title={atLimit ? `보기는 ${MAX_SAVED_VIEWS}개까지 저장할 수 있습니다.` : "현재 조건을 새 보기로 저장"}
					disabled={atLimit}
					onClick={() => openDialog({ mode: "create" })}
				>
					<Plus aria-hidden />
				</Button>
			)}

			<Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>{dialog?.mode === "rename" ? "보기 이름 변경" : "새 보기로 저장"}</DialogTitle>
						<DialogDescription>
							검색·필터·정렬·컬럼 설정을 저장합니다. 폴더는 저장하지 않으므로 어느 폴더에서든 쓸 수 있습니다.
						</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							submit();
						}}
					>
						<Field>
							<FieldLabel htmlFor="saved-view-name">보기 이름</FieldLabel>
							<Input
								id="saved-view-name"
								autoFocus
								maxLength={60}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setDialog(null)}>
								취소
							</Button>
							<Button type="submit" disabled={!name.trim()}>
								{dialog?.mode === "rename" ? "이름 변경" : "저장"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</nav>
	);
}
