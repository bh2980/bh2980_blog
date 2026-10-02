import { toast } from "sonner";

/** 미디어 목록 API의 한 항목. */
export interface MediaItem {
	id: string;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

/** 목록·타일에 붙는 사용 여부. */
export const usageLabel = (media: MediaItem) =>
	media.status === "deleting" ? "삭제 중" : media.referencesCount > 0 ? `사용 ${media.referencesCount}` : "미사용";

export async function copyText(text: string, success: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(success);
	} catch {
		toast.error("복사하지 못했습니다.");
	}
}

/** 새 이름에 원래 파일의 확장자를 붙인다(추천 이름은 확장자 없이 온다). 이미 같은 확장자면 그대로 둔다. */
export function withExtension(name: string, original: string): string {
	const extension = /\.[A-Za-z0-9]{1,8}$/.exec(original)?.[0]?.toLowerCase() ?? "";
	return extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
}
