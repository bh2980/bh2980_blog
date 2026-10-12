/**
 * 홈 맨 앞에 거는 작품(three.js 같은 인터랙티브 체험). 비어 있으면 홈에 작품 자리가 아예 보이지 않는다.
 *
 * 작품 쪽은 각자 원하는 모양으로 만든다. 블로그는 액자(가는 테두리)와 설명 한 줄만 그린다.
 * 맨 앞 작품이 홈 권두화가 되고, 나머지는 차례의 "작품" 묶음에 들어간다.
 */
export type Work = {
	slug: string;
	title: string;
	/** 설명 한 줄에 적는 도구. 예: "three.js" */
	tools: string;
	year: number;
	/** 작품 쪽 주소 */
	href: string;
	/** 권두화 자리에 보이는 정지 그림. 작품을 직접 띄우기 전까지 이 그림을 보인다. */
	poster?: string;
};

export const WORKS: readonly Work[] = [];
