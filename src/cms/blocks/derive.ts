import type { BlockDefinition } from "./define";
import { BLOCKS, columns, tabs, textAlign } from "./definitions";

/**
 * 블록 정의에서 저장 문법 표·검증 규칙·상수를 만든다(v2 B3). 순수 함수이며 서버·에디터·공개 렌더러가 함께 쓴다.
 */

export const BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition> = new Map(BLOCKS.map((block) => [block.name, block]));

/** 지시자 문법 블록(`:::`·`::`·`:`). 코드 펜스·수식은 Markdown 문법이라 지시자 표에 없다. */
export const directiveBlocks = (): BlockDefinition[] =>
	BLOCKS.filter(
		(block): block is (typeof BLOCKS)[number] =>
			block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text",
	);

/** 선택 값이 정해진 속성을 벗어나면 그 속성 이름. 발행 전 검사가 `invalid_block_attribute`로 알린다. */
export function invalidOptionAttributes(
	block: BlockDefinition,
	attributes: Readonly<Record<string, unknown>>,
): string[] {
	const invalid: string[] = [];
	for (const [name, attribute] of Object.entries(block.attributes)) {
		const value = attributes[name];
		if (!attribute.options || typeof value !== "string" || value === "") continue;
		if (!Object.hasOwn(attribute.options, value)) invalid.push(name);
	}
	return invalid;
}

const optionValues = (block: BlockDefinition, attribute: string): readonly string[] =>
	Object.keys(block.attributes[attribute]?.options ?? {});

/** §4.4가 허용하는 정렬 값. `justify`는 쓰지 않는다(A4). */
export const TEXT_ALIGN_VALUES = optionValues(textAlign, "align") as readonly ("left" | "center" | "right")[];

export const TABS_MIN = tabs.children.min;
export const TABS_MAX = tabs.children.max;
export const COLUMNS_MIN = columns.children.min;
export const COLUMNS_MAX = columns.children.max;
