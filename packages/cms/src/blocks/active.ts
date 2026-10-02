import { cmsConfig } from "../config/resolved";
import type { BlockDefinition } from "./define";
import { resolveBlocks } from "./resolve";

/** 사이트가 쓰는 본문 블록(내장 블록 중 켠 것 + 사용자 블록). 저장 문법 표·검사·편집기·`/meta`가 읽는다. */
export const BLOCKS: readonly BlockDefinition[] = resolveBlocks(cmsConfig.blocks);

const ACTIVE = new Set(BLOCKS.map((block) => block.name));

/** 이 블록을 쓰는가(끄지 않았는가). */
export const isBlockActive = (name: string): boolean => ACTIVE.has(name);

/** 사용자 블록(사이트 설정의 `blocks.custom`). */
export const CUSTOM_BLOCKS: readonly BlockDefinition[] = cmsConfig.blocks?.custom ?? [];
