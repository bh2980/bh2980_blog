import type { BulkOp } from "@bh2980/cms/client";
import { taxonomyFieldsOf } from "@bh2980/cms/client";
import type { Folder, ListEntriesItem } from "@bh2980/cms/runtime";
import {
	Archive,
	ArchiveRestore,
	Copy,
	ExternalLink,
	Folder as FolderIcon,
	FolderInput,
	FolderUp,
	PanelRightOpen,
	RotateCcw,
	SquarePen,
	Tag,
	Tags,
	Trash2,
} from "lucide-react";
import { josa } from "../lib/utils/josa";
import type { BulkSelection, runBulk } from "./entries/bulk-bar";
import type { MenuAction } from "./shared/action-menu";
import type { TaxonomyOptions } from "./shared/use-taxonomy";

export type BulkParams = NonNullable<Parameters<typeof runBulk>[2]>;

export const toSelection = (item: ListEntriesItem): BulkSelection => ({
	id: item.id,
	expectedVersion: item.version,
	title: item.title,
});

/**
 * 오른쪽 클릭·Delete 키의 대상. 누른 줄이 고른 줄 가운데 하나이고 둘 이상 골랐으면 고른 줄 전체, 아니면 그 줄 하나다(v2 A2).
 */
export function actionTargets(
	item: ListEntriesItem,
	items: readonly ListEntriesItem[],
	selectedIds: ReadonlySet<string>,
): ListEntriesItem[] {
	return selectedIds.has(item.id) && selectedIds.size > 1 ? items.filter((row) => selectedIds.has(row.id)) : [item];
}

export interface RowMenuContext {
	mode: "list" | "trash";
	/** 태그·카테고리·모음집처럼 작은 폼으로 여는 컬렉션. */
	isRecord: boolean;
	/** 보관할 수 있는 컬렉션(글·메모). */
	isContent: boolean;
	folders: readonly Folder[];
	collection: string;
	/** 분류 필드 이름 → 선택지. 여러 개 분류 필드(태그 등)마다 "○○ 추가" 하위 메뉴를 만든다. */
	options: TaxonomyOptions;
}

/** 메뉴 항목이 부르는 작업. 대상은 항상 `actionTargets`로 고른 줄이다. */
export interface RowMenuHandlers {
	openEditor: (item: ListEntriesItem) => void;
	openInNewTab: (item: ListEntriesItem) => void;
	openRecord: (item: ListEntriesItem) => void;
	duplicate: (item: ListEntriesItem) => void;
	restore: (targets: BulkSelection[]) => void;
	confirmTrash: (targets: BulkSelection[]) => void;
	/** 보관은 공개 글을 내리므로 묻고 한다(하나든 여럿이든). */
	confirmArchive: (targets: BulkSelection[]) => void;
	confirmPermanentDelete: (targets: BulkSelection[]) => void;
	bulk: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => void;
}

/** 행 메뉴(v2 A2). 한 줄이면 열기·복제를, 여러 줄이면 맨 위에 항목 수를 둔다. 휴지통은 복원·영구 삭제뿐이다. */
export function rowMenuActions(
	group: readonly ListEntriesItem[],
	context: RowMenuContext,
	handlers: RowMenuHandlers,
): MenuAction[] {
	const targets = group.map(toSelection);
	const single = group.length === 1 ? group[0] : undefined;
	const header: MenuAction[] = single ? [] : [{ kind: "label", label: `${group.length}개 항목` }];

	if (context.mode === "trash") {
		return [
			...header,
			{ kind: "item", label: "복원", icon: RotateCcw, onSelect: () => handlers.restore(targets) },
			{ kind: "separator" },
			{
				kind: "item",
				label: "영구 삭제",
				icon: Trash2,
				shortcut: "Del",
				destructive: true,
				onSelect: () => handlers.confirmPermanentDelete(targets),
			},
		];
	}

	const open: MenuAction[] = !single
		? []
		: context.isRecord
			? [{ kind: "item", label: "열기", icon: PanelRightOpen, onSelect: () => handlers.openRecord(single) }]
			: [
					{ kind: "item", label: "열기", icon: SquarePen, onSelect: () => handlers.openEditor(single) },
					{ kind: "item", label: "새 탭에서 열기", icon: ExternalLink, onSelect: () => handlers.openInNewTab(single) },
					{ kind: "item", label: "복제", icon: Copy, onSelect: () => handlers.duplicate(single) },
				];
	const allArchived = group.every((row) => row.status === "archived");
	const addActions: MenuAction[] = taxonomyFieldsOf(context.collection).flatMap((stored): MenuAction[] => {
		if (stored.field.kind !== "relation" || !stored.field.many) return [];
		const label = stored.field.label;
		return [
			{
				kind: "sub",
				label: `${label} 추가`,
				icon: Tags,
				emptyLabel: `${josa(label, "이", "가")} 없습니다`,
				items: (context.options[stored.name] ?? []).map((option) => ({
					kind: "item" as const,
					label: option.title,
					icon: Tag,
					onSelect: () =>
						handlers.bulk("relation.add", `${josa(label, "을", "를")} 추가`, targets, {
							field: stored.name,
							ids: [option.id],
						}),
				})),
			},
		];
	});
	const contentActions: MenuAction[] = context.isContent
		? [
				...addActions,
				{ kind: "separator" },
				allArchived
					? {
							kind: "item",
							label: "보관 해제",
							icon: ArchiveRestore,
							onSelect: () => handlers.bulk("unarchive", "보관 해제", targets),
						}
					: { kind: "item", label: "보관", icon: Archive, onSelect: () => handlers.confirmArchive(targets) },
			]
		: [{ kind: "separator" }];

	return [
		...header,
		...open,
		{ kind: "separator" },
		{
			kind: "sub",
			label: "폴더로 이동",
			icon: FolderInput,
			items: [
				{
					kind: "item",
					label: "최상위",
					icon: FolderUp,
					onSelect: () => handlers.bulk("folder.move", "옮김", targets, { folderId: null }),
				},
				...context.folders.map((folder) => ({
					kind: "item" as const,
					label: folder.name,
					icon: FolderIcon,
					onSelect: () => handlers.bulk("folder.move", "옮김", targets, { folderId: folder.id }),
				})),
			],
		},
		...contentActions,
		{
			kind: "item",
			label: "휴지통으로 이동",
			icon: Trash2,
			shortcut: "Del",
			destructive: true,
			onSelect: () => handlers.confirmTrash(targets),
		},
	];
}
