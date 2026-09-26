/** 목록 행을 폴더로 끌어 옮길 때 쓰는 데이터 형식(§3.3 "글은 드래그 또는 일괄 이동 메뉴로 이동"). */
export const ENTRY_DRAG_TYPE = "application/x-cms-entries";

export type DraggedEntry = { id: string; expectedVersion: number };

export function writeDraggedEntries(event: React.DragEvent, entries: DraggedEntry[]) {
	event.dataTransfer.setData(ENTRY_DRAG_TYPE, JSON.stringify(entries));
	event.dataTransfer.effectAllowed = "move";
}

export function readDraggedEntries(event: React.DragEvent): DraggedEntry[] {
	try {
		const parsed = JSON.parse(event.dataTransfer.getData(ENTRY_DRAG_TYPE) || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const isEntryDrag = (event: React.DragEvent) => event.dataTransfer.types.includes(ENTRY_DRAG_TYPE);
