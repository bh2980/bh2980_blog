export interface SlashCommandItem {
	title: string;
	description: string;
	keywords: string[];
	action: (editor: any, range: any) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
	{
		title: "문단 (Paragraph)",
		description: "일반 텍스트 본문",
		keywords: ["본문", "텍스트", "문단", "paragraph", "p"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setParagraph().run();
		},
	},
	{
		title: "제목 1 (H1)",
		description: "가장 큰 섹션 제목",
		keywords: ["제목", "h1", "heading1", "대제목"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
		},
	},
	{
		title: "제목 2 (H2)",
		description: "중간 섹션 제목",
		keywords: ["제목", "h2", "heading2", "중제목"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
		},
	},
	{
		title: "제목 3 (H3)",
		description: "소제목",
		keywords: ["제목", "h3", "heading3", "소제목"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
		},
	},
	{
		title: "글머리 기호 목록",
		description: "순서 없는 불릿 리스트",
		keywords: ["목록", "불릿", "리스트", "bullet", "list", "ul"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: "번호 매기기 목록",
		description: "순서가 있는 숫자 리스트",
		keywords: ["순서", "번호", "목록", "ordered", "numbered", "list", "ol"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: "인용구 (Quote)",
		description: "강조하고 싶은 인용 문구",
		keywords: ["인용", "인용구", "quote", "blockquote"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		title: "코드 블록 (Code Block)",
		description: "프로그래밍 코드 삽입",
		keywords: ["코드", "코드블록", "code", "pre"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: "구분선 (Divider)",
		description: "가로 구분선",
		keywords: ["구분선", "가로줄", "선", "divider", "hr"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: "이미지 (Image)",
		description: "사진 또는 그림 업로드",
		keywords: ["이미지", "사진", "그림", "image", "img", "photo"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run();
			// Trigger file selection dialog
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
			input.onchange = async () => {
				const file = input.files?.[0];
				if (file) {
					window.dispatchEvent(new CustomEvent("cms:upload-image", { detail: { file } }));
				}
			};
			input.click();
		},
	},
];

export function filterCommands(query: string): SlashCommandItem[] {
	if (!query) return SLASH_COMMANDS;
	const clean = query.trim().toLowerCase();
	return SLASH_COMMANDS.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
