import { describe, expect, it } from "vitest";
import { findActiveWrapperDepth, getActiveWrapperSelectionRange, isInAnyWrapper } from "../wrapper-keys";

const createMockState = ({
	depth,
	start,
	end,
	group = "component3",
	content = "block+",
}: {
	depth: number;
	start: number;
	end: number;
	group?: string;
	content?: string;
}) =>
	({
		selection: {
			$from: {
				depth,
				node: (currentDepth: number) => ({
					type:
						currentDepth === depth
							? {
									spec: { group, content },
								}
							: {
									spec: {},
								},
				}),
				start: () => start,
				end: () => end,
			},
		},
	}) as never;

describe("wrapper-keys", () => {
	it("현재 selection이 wrapper 안에 있으면 depth를 찾는다", () => {
		const state = createMockState({ depth: 3, start: 10, end: 24 });

		expect(findActiveWrapperDepth(state)).toBe(3);
		expect(isInAnyWrapper(state)).toBe(true);
	});

	it("wrapper 내부만 선택하도록 범위를 계산한다", () => {
		const state = createMockState({ depth: 2, start: 8, end: 20 });

		expect(getActiveWrapperSelectionRange(state)).toEqual({ from: 9, to: 19 });
	});

	it("wrapper가 아니면 null을 반환한다", () => {
		const state = createMockState({
			depth: 2,
			start: 8,
			end: 20,
			group: "block",
			content: "inline*",
		});

		expect(findActiveWrapperDepth(state)).toBeNull();
		expect(isInAnyWrapper(state)).toBe(false);
		expect(getActiveWrapperSelectionRange(state)).toBeNull();
	});
});
