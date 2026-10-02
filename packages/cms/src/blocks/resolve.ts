import type { BlockDefinition } from "./define";
import { BUILTIN_BLOCKS } from "./definitions";

/**
 * 사이트가 끌 수 있는 내장 블록. 지시자·코드 펜스로 저장하고 다른 기능이 기대지 않는 블록만 끈다.
 * 자식 전용 블록(`tab`·`column`)은 부모와 함께 꺼진다.
 *
 * 끈 블록은 지시자 표에서 빠진다. 이미 그 블록을 쓴 본문은 다시 저장할 때 일반 글로 바뀌므로 쓰던 블록은 끄지 않는다.
 */
export const OPTIONAL_BLOCKS = ["callout", "collapsible", "tabs", "columns", "mermaid", "chart"] as const;
export type OptionalBlockName = (typeof OPTIONAL_BLOCKS)[number];

/** 사이트 설정의 본문 블록 설정. */
export interface BlocksConfig {
	/** 끌 내장 블록. */
	readonly disable?: readonly OptionalBlockName[];
	/**
	 * 사용자 블록(`defineBlock`). 지시자(`:::이름`·`::이름`) 블록만 더할 수 있다. 공개 렌더러는 `component` 이름으로
	 * 사이트가 그리고, 편집기는 `editor.view: "node"`면 사이트가 등록한 편집 컴포넌트(없으면 기본 속성 상자),
	 * 아니면 원문 보존 상자로 보인다.
	 */
	readonly custom?: readonly BlockDefinition[];
}

const NAME = /^[a-z][a-z0-9-]*$/;
const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;

/** 설정에 맞는 블록 목록. 내장 블록(끈 것과 그 자식 제외) 다음에 사용자 블록이다. 틀린 설정이면 오류를 던진다. */
export function resolveBlocks(config: BlocksConfig | undefined): readonly BlockDefinition[] {
	const disabled = new Set<string>(config?.disable ?? []);
	for (const name of disabled) {
		if (!(OPTIONAL_BLOCKS as readonly string[]).includes(name)) {
			throw new Error(`cms.config: blocks.disable: "${name}" cannot be turned off`);
		}
	}
	const builtins: BlockDefinition[] = BUILTIN_BLOCKS.filter(
		(block: BlockDefinition) => !disabled.has(block.name) && !(block.parent && disabled.has(block.parent)),
	);
	const custom = config?.custom ?? [];
	const taken = new Set<string>([
		...BUILTIN_BLOCKS.map((block) => block.name),
		...BUILTIN_BLOCKS.map((block) => block.component),
	]);
	const directives = new Set<string>(
		BUILTIN_BLOCKS.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])),
	);
	for (const block of custom) {
		const where = `cms.config: blocks.custom.${block.name}`;
		if (!NAME.test(block.name)) throw new Error(`${where}: name must be lower-case kebab`);
		if (block.syntax.kind !== "container" && block.syntax.kind !== "leaf") {
			throw new Error(`${where}: only container or leaf directive blocks can be added`);
		}
		if (block.syntax.directive !== block.name) throw new Error(`${where}: directive must equal the block name`);
		if (!COMPONENT.test(block.component)) throw new Error(`${where}: component must be PascalCase`);
		if (taken.has(block.name) || taken.has(block.component) || directives.has(block.syntax.directive)) {
			throw new Error(`${where}: name or component is already used`);
		}
		if (block.editor.view !== "node" && block.editor.view !== "opaque") {
			throw new Error(`${where}: editor.view must be "node" or "opaque"`);
		}
		taken.add(block.name);
		taken.add(block.component);
	}
	const blocks = [...builtins, ...custom];
	const names = new Set(blocks.map((block) => block.name));
	for (const block of custom) {
		if (block.parent && !names.has(block.parent)) {
			throw new Error(`cms.config: blocks.custom.${block.name}: parent "${block.parent}" is not a block`);
		}
		for (const child of block.children?.blocks ?? []) {
			// 사용자 블록의 자식은 사용자 블록이다(편집기 노드를 같은 방식으로 만든다).
			if (!custom.some((candidate) => candidate.name === child && candidate.parent === block.name)) {
				throw new Error(
					`cms.config: blocks.custom.${block.name}: child "${child}" must be a custom block with this parent`,
				);
			}
		}
	}
	return blocks;
}
