/**
 * 공개 블로그 화면의 고정 문구(v2 B4). 기본 언어(한국어) 사전이자 키 목록의 기준이다.
 *
 * - 다른 언어 사전(`en.ts`·`ja.ts`)은 이 키를 그대로 쓰고 값만 바꾼다. 비어 있는 키는 한국어로 보인다.
 * - `{name}` 자리는 호출할 때 값을 넣는다.
 * - 관리자(CMS) 화면 문구는 여기에 두지 않는다(관리자 화면은 한국어 그대로다).
 */
export const ko = {
	"site.description": "bh2980의 개발 블로그",
	"site.notFound": "찾을 수 없음",

	"nav.blog": "블로그",
	"nav.memos": "메모장",
	"nav.admin": "관리자",
	"nav.openMenu": "메뉴 열기",
	"nav.menu": "메뉴",
	"theme.toLight": "라이트 모드로 전환",
	"theme.toDark": "다크 모드로 전환",
	"language.label": "언어",
	"language.switch": "다른 언어로 보기",

	"footer.rights": "All rights reserved.",
	"footer.externalLinks": "관련 외부 페이지 이동",
	"footer.github": "깃허브",
	"footer.tistory": "티스토리 블로그",
	"footer.rss": "RSS",

	"home.badge": "개발하면서 써둔 기록들",
	"home.greeting": "안녕하세요 👋",
	"home.intro": "개발하다가 배운 것, 해본 것, 까먹기 싫은 것들을 적어두는 곳이에요.",
	"home.browsePosts": "블로그 둘러보기",
	"home.browseMemos": "메모 살펴보기",
	"home.statPosts": "게시글",
	"home.statMemos": "메모",
	"home.statTags": "태그",
	"home.tagsNote": "태그는 글과 메모에 함께 사용됩니다.",
	"home.latestPosts": "최근 글",
	"home.latestMemos": "최근 메모",
	"home.viewAll": "전체 보기",
	"home.noPosts": "아직 작성된 게시글이 없습니다.",
	"home.noMemos": "아직 작성된 메모가 없습니다.",
	"home.noTagsOnMemo": "태그 없음",
	"home.featuredTags": "주요 태그",
	"home.noFeaturedTags": "아직 태그가 없습니다.",

	"posts.title": "블로그",
	"posts.description": "개발하면서 배운 것들과 경험을 기록합니다.",
	"posts.all": "전체 ({count})",
	"posts.empty": "아직 작성된 게시글이 없습니다.",

	"memos.title": "메모",
	"memos.metaTitle": "메모장",
	"memos.description": "개발 중에 자주 쓰는 팁, 문제 해결 기록, 코드 스니펫을 모아둡니다.",
	"memos.tagPlaceholder": "태그 선택",
	"memos.tagFilter": "태그로 메모 거르기",
	"memos.tagEmpty": "일치하는 태그가 없습니다.",
	"memos.empty": "아직 작성된 메모가 없습니다.",

	"detail.back": "돌아가기",
	"detail.backNav": "리스트로 돌아가기",
	"detail.pageNav": "상세 페이지 이동",
	"detail.prev": "이전 글",
	"detail.next": "다음 글",
	"post.deprecatedTitle": "더 이상 관리하지 않는 글입니다",
	"post.deprecatedBefore": "최신 내용은 ",
	"post.deprecatedAfter": "에서 확인하세요.",
	"post.deprecatedNoReplacement": "내용이 현재와 다를 수 있습니다.",
	"post.stale": "이 글은 작성된 지 오래되어 최신 내용과 다를 수 있습니다.",

	"mdx.expand": "펼치기",
	"mdx.copy": "클립보드에 복사하기",
	"mdx.imageUnavailable": "이미지를 표시할 수 없습니다",
	"mdx.chartError": "차트 문법 오류",
	"mdx.chartErrorLine": "{line}줄: {message}",
} as const;

export type MessageKey = keyof typeof ko;
export type Messages = Partial<Record<MessageKey, string>>;
