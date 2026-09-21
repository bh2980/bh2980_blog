import { createHash } from "node:crypto";

/**
 * 이전 전용 UUIDv5 네임스페이스. 한 번 정해지면 바꾸지 않는다(바꾸면 ID가 전부 달라진다).
 */
const NAMESPACE = "0f6a3f9c-6c2f-4d5a-9b7e-2f4a6c8d0e11";

const uuidToBytes = (uuid: string): Buffer => Buffer.from(uuid.replace(/-/g, ""), "hex");

/**
 * 기존 파일에서 안정적인 UUID를 만든다.
 * 키는 `kind + NUL + NFC(저장소 상대 POSIX 경로)`다. slug는 바뀔 수 있으므로 키로 쓰지 않는다.
 */
export function stableId(kind: string, sourcePath: string): string {
	const name = `${kind}\u0000${sourcePath.normalize("NFC")}`;
	const digest = createHash("sha1").update(uuidToBytes(NAMESPACE)).update(Buffer.from(name, "utf8")).digest();
	const bytes = Buffer.from(digest.subarray(0, 16));
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50; // version 5
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant RFC 4122
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
