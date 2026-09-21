/**
 * M5-ED-1 필드·블록 확장 예제 (F07)
 * 코어를 수정하지 않고 필드/블록을 붙이는 경로를 정의합니다.
 */

export interface CustomFieldDefinition {
	readonly type: string;
	readonly label: string;
	readonly defaultValue?: unknown;
	readonly validate?: (val: unknown) => boolean;
}

export interface FieldHelperDefinition {
	readonly targetField: string;
	readonly actionName: string;
	readonly label: string;
	readonly onAction?: (currentValue: string) => Promise<string> | string;
}

export interface ObjectFieldDefinition {
	readonly type: string;
	readonly label: string;
	readonly properties: Record<string, { type: string; required?: boolean; defaultValue?: unknown }>;
}

export interface CustomBlockDefinition {
	readonly name: string;
	readonly component: string;
	readonly props: Record<string, { type: string; options?: readonly string[]; default?: unknown; optional?: boolean }>;
	readonly hasChildren?: boolean;
}

// 1. 색상 필드 예제
export const colorFieldExample: CustomFieldDefinition = {
	type: "custom:color",
	label: "테마 색상",
	defaultValue: "#3b82f6",
	validate: (val: unknown) => typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val),
};

// 2. Slug 보조 버튼 예제
export const slugHelperExample: FieldHelperDefinition = {
	targetField: "slug",
	actionName: "translateAndSlugify",
	label: "영문 자동 생성",
	onAction: (val) => val.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
};

// 3. 링크 Object 복합 필드 예제
export const linkObjectFieldExample: ObjectFieldDefinition = {
	type: "custom:link",
	label: "관련 링크",
	properties: {
		url: { type: "string", required: true },
		label: { type: "string", required: true },
		targetBlank: { type: "boolean", defaultValue: true },
	},
};

// 4. 코드 Fence 블록 예제
export const calloutBlockExample: CustomBlockDefinition = {
	name: "Callout",
	component: "Callout",
	props: {
		type: { type: "string", options: ["info", "warning", "tip"], default: "info" },
		title: { type: "string", optional: true },
	},
	hasChildren: true,
};

/**
 * /meta API 응답 또는 직렬화용 스키마 추출 함수.
 * React 함수나 실행 클로저(validate, onAction 등)는 철저히 제거하고
 * 순수 JSON 직렬화 가능한 메타데이터만 반환합니다.
 */
export function getSerializableExtensionsSchema() {
	return {
		fields: [
			{
				type: colorFieldExample.type,
				label: colorFieldExample.label,
				defaultValue: colorFieldExample.defaultValue,
			},
			{
				type: linkObjectFieldExample.type,
				label: linkObjectFieldExample.label,
				properties: linkObjectFieldExample.properties,
			},
		],
		helpers: [
			{
				targetField: slugHelperExample.targetField,
				actionName: slugHelperExample.actionName,
				label: slugHelperExample.label,
			},
		],
		blocks: [
			{
				name: calloutBlockExample.name,
				component: calloutBlockExample.component,
				props: calloutBlockExample.props,
				hasChildren: calloutBlockExample.hasChildren,
			},
		],
	};
}
