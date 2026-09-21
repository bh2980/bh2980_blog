const DB_NAME = "bh2980_cms_backup";
const STORE_NAME = "backups";
const DB_VERSION = 1;

export interface LocalBackupRecord {
	key: string; // `${adminId}:${entryId}`
	entryId: string;
	baseVersion: number;
	baseFingerprint: string;
	localFingerprint: string;
	snapshot: {
		title: string;
		slug: string | null;
		metadata: Record<string, unknown>;
		mdx: string;
	};
	changeSeq: number;
	savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined" || !window.indexedDB) {
			return reject(new Error("IndexedDB not available"));
		}
		const request = window.indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveLocalBackup(record: LocalBackupRecord): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.put(record);
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch (err) {
		console.warn("Failed to save local backup in IndexedDB", err);
	}
}

export async function getLocalBackup(key: string): Promise<LocalBackupRecord | null> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const request = store.get(key);
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	} catch (err) {
		console.warn("Failed to read local backup from IndexedDB", err);
		return null;
	}
}

export async function deleteLocalBackup(key: string): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.delete(key);
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch (err) {
		console.warn("Failed to delete local backup from IndexedDB", err);
	}
}
