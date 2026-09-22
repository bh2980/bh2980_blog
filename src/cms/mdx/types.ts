import type { Root } from "mdast";

export type CmsMdxPosition = {
	line: number;
	column: number;
};

export type CmsMdxError = {
	message: string;
	position: CmsMdxPosition;
};

export type CmsJsonValue = string | number | boolean | null | CmsJsonValue[] | { [key: string]: CmsJsonValue };

export type CmsJsxAttribute = {
	name?: string;
	value?: CmsJsonValue;
	expression?: string;
	spread?: boolean;
};

export type CmsMark = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
};

export type CmsNode = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
	content?: CmsNode[];
	marks?: CmsMark[];
	text?: string;
};

export type CmsMdxAnalysis = {
	source: string;
	errors: CmsMdxError[];
	name?: string;
	frontmatter: Record<string, CmsJsonValue> | null;
	tree: Root | null;
};

/**
 * 본문에 쓰인 이미지 소스. **DB 의미가 없는 순수 사실이다** — `mediaId`가 실제 미디어 행을
 * 가리키는지, 그 행이 `ready`인지는 발행 전 검사가 판단한다.
 */
export type CmsImageSource = {
	/** 등록 미디어 참조. `src`와 배타적이다. */
	readonly mediaId?: string;
	/** 외부 주소. */
	readonly src?: string;
	readonly position: CmsMdxPosition;
};
