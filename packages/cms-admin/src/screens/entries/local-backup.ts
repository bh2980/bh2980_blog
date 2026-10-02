/**
 * 브라우저 복구본(§5.1). IndexedDB에 편집 중인 최신 입력을 남긴다.
 *
 * - 키는 `관리자 ID:콘텐츠 ID`(새 글은 `관리자 ID:new:컬렉션`)라 다른 계정의 복구본과 섞이지 않는다.
 * - 저장에 실패하면(사생활 보호 모드·저장 공간 거부 등) `false`를 돌려 화면이 복구 불가를 정확히 표시하게 한다.
 */

const DB_NAME = "bh2980_cms_backup";
const STORE_NAME = "backups";
const DB_VERSION = 1;

export interface LocalBackupRecord<Snapshot = Record<string, unknown>> {
	key: string;
	entryId: string;
	/** 복구본을 만들 때 기준으로 삼은 서버 버전. */
	baseVersion: number;
	baseFingerprint: string;
	localFingerprint: string;
	snapshot: Snapshot;
	changeSeq: number;
	savedAt: number;
}

export const backupKey = (adminId: string, entryId: string | null, collection: string) =>
	entryId ? `${adminId}:${entryId}` : `${adminId}:new:${collection}`;

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined" || !window.indexedDB) {
			reject(new Error("IndexedDB not available"));
			return;
		}
		const request = window.indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await openDB();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const request = action(tx.objectStore(STORE_NAME));
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

/** 복구본을 남긴다. 실패하면 `false`다. */
export async function saveLocalBackup(record: LocalBackupRecord): Promise<boolean> {
	try {
		await run("readwrite", (store) => store.put(record));
		return true;
	} catch {
		return false;
	}
}

export async function getLocalBackup<Snapshot = Record<string, unknown>>(
	key: string,
): Promise<LocalBackupRecord<Snapshot> | null> {
	try {
		return ((await run("readonly", (store) => store.get(key))) as LocalBackupRecord<Snapshot> | undefined) ?? null;
	} catch {
		return null;
	}
}

export async function deleteLocalBackup(key: string): Promise<void> {
	try {
		await run("readwrite", (store) => store.delete(key));
	} catch {
		// 지우지 못한 복구본은 다음에 열 때 서버와 같으면 다시 지운다.
	}
}
