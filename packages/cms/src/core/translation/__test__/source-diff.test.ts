import { describe, expect, it } from "vitest";
import { diffSources, type SourceChange } from "../source-diff";

const summary = (changes: SourceChange[] | null) =>
	changes?.map((change) =>
		change.kind === "changed"
			? ["changed", change.before.source, change.after.source]
			: change.kind === "added"
				? ["added", change.after.source]
				: ["removed", change.before.source],
	);

describe("원문 두 버전 비교(v3)", () => {
	it("같으면 바뀐 것이 없다", () => {
		expect(diffSources("하나\n\n둘\n", "하나\n\n둘\n")).toEqual([]);
	});

	it("바뀐·더해진·빠진 블록을 문서 순서로 찾는다", () => {
		expect(
			summary(diffSources("하나\n\n둘\n\n셋\n\n넷\n", "하나 고침\n\n둘\n\n새 문단\n\n넷\n\n## 새 제목\n")),
		).toEqual([
			["changed", "하나", "하나 고침"],
			["changed", "셋", "새 문단"],
			["added", "## 새 제목"],
		]);
		expect(summary(diffSources("하나\n\n둘\n\n셋\n", "하나\n\n셋\n"))).toEqual([["removed", "둘"]]);
	});

	it("상자 안 블록과 제목도 따로 비교한다", () => {
		const before = ':::callout{variant="note" title="알림"}\n안쪽\n:::\n';
		const after = ':::callout{variant="note" title="주의"}\n안쪽 고침\n:::\n';
		expect(summary(diffSources(before, after))).toEqual([
			["changed", JSON.stringify({ title: "알림" }), JSON.stringify({ title: "주의" })],
			["changed", "안쪽", "안쪽 고침"],
		]);
	});

	it("탭 이름은 탭 묶음 머리 줄 하나로 모아 비교한다", () => {
		const tabs = (second: string) =>
			`::::tabs\n:::tab{label="하나"}\n첫째\n:::\n:::tab{label="${second}"}\n둘째\n:::\n::::\n`;
		expect(summary(diffSources(tabs("둘"), tabs("둘 고침")))).toEqual([
			["changed", JSON.stringify({ labels: ["하나", "둘"] }), JSON.stringify({ labels: ["하나", "둘 고침"] })],
		]);
	});

	it("해석할 수 없는 원문이면 null", () => {
		expect(diffSources("본문 <Callout>닫히지 않음", "하나\n")).toBeNull();
	});
});
