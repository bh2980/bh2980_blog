import { useCmsAdminComponents } from "@bh2980/cms-admin";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { bareun } from "..";
import bareunAdmin from "../admin";

afterEach(cleanup);

function Checkers() {
	const { textCheckers = [] } = useCmsAdminComponents();
	return (
		<ul>
			{textCheckers.map((checker) => (
				<li key={checker.id}>{`${checker.id}|${checker.label}|${checker.locales?.join(",")}|${checker.auto}`}</li>
			))}
		</ul>
	);
}

describe("바른 검사기 관리자 쪽", () => {
	it("공급자가 사이트 설정의 값으로 원격 검사기를 넣는다", () => {
		const Provider = bareunAdmin.Provider;
		expect(Provider).toBeDefined();
		if (!Provider) return;
		render(
			<Provider>
				<Checkers />
			</Provider>,
		);
		// 테스트 설정(`test/cms.config.ts`)의 이름이다. 자동 검사는 기본으로 끈다.
		expect(screen.getByRole("listitem").textContent).toBe("bareun|바른 검사|ko|false");
	});

	it("플러그인 정의는 기본값을 채우고 잘못된 값을 막는다", () => {
		const plugin = bareun();
		expect(plugin.name).toBe("text-check-bareun");
		expect(plugin.options).toEqual({
			apiKeyEnv: "BAREUN_API_KEY",
			baseUrl: "https://api.bareun.ai",
			label: "바른",
			auto: false,
			customDictNames: [],
			limits: { maxSegments: 100, maxChars: 10_000 },
		});
		expect(typeof plugin.server).toBe("function");
		expect(typeof plugin.admin).toBe("function");
		expect(() => bareun({ apiKeyEnv: "bad key" })).toThrow();
		expect(() => bareun({ limits: { maxChars: 0 } })).toThrow();
	});
});
