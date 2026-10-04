import { definePlugin } from "@monti-cms/core";

/**
 * 이 블로그의 예전 목록 열 이름 옮기기(사이트 마이그레이션). 예전 관리자 화면은 분류 열 설정을 짧은 이름(`category`·`tags`)으로
 * 저장했다. 지금 열 이름은 필드 이름(`categoryId`·`tagIds`)이라 `pnpm cms:db:migrate`가 저장된 관리자 설정의 열 이름을 바꾼다.
 * 본체는 예전 이름을 짐작하지 않는다(M10-3). 여러 번 돌려도 같다.
 */
export const legacyListColumns = () =>
	definePlugin({
		name: "legacy-list-columns",
		options: {},
		server: () => import("./legacy-list-columns.server"),
	});
