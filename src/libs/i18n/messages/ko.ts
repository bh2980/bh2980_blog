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

	"nav.blog": "글",
	"nav.memos": "메모",
	"nav.series": "모음집",
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
	"footer.tistory": "티스토리",
	"footer.rss": "RSS",
	"footer.author": "지은이",
	"footer.edition": "판",
	"footer.updated": "고친 날",
	"footer.subscribe": "받아 보기",

	"home.works": "작품",
	"home.posts": "글",
	"home.memos": "메모",
	"home.series": "모음집",
	"home.allPosts": "모든 글",
	"home.allMemos": "메모 {count}개",
	"home.allSeries": "모든 모음집",
	"home.noPosts": "아직 작성된 게시글이 없습니다.",
	"home.noMemos": "아직 작성된 메모가 없습니다.",
	"home.noSeries": "아직 모음집이 없습니다.",

	"posts.title": "글",
	"posts.description": "개발하면서 배운 것들과 경험을 기록합니다.",
	"posts.all": "전체 ({count})",
	"posts.empty": "아직 작성된 게시글이 없습니다.",

	"memos.title": "메모",
	"memos.metaTitle": "메모",
	"memos.description": "개발 중에 자주 쓰는 팁, 문제 해결 기록, 코드 스니펫을 모아둡니다.",
	"memos.tagPlaceholder": "태그 선택",
	"memos.tagFilter": "태그로 메모 거르기",
	"memos.tagEmpty": "일치하는 태그가 없습니다.",
	"memos.empty": "아직 작성된 메모가 없습니다.",
	"memos.find": "찾을 말",
	"memos.allTags": "모든 태그",
	"memos.noMatch": "찾는 메모가 없습니다.",
	"memos.shelf": "태그 책장",

	"series.title": "모음집",
	"series.description": "순서대로 엮은 글과 메모",
	"series.empty": "아직 모음집이 없습니다.",
	"series.emptyItems": "아직 담긴 글이 없습니다.",
	"series.postCount": "글 {count}",
	"series.memoCount": "메모 {count}",
	"series.position": "{index} / {total}",
	"series.prev": "앞",
	"series.next": "다음",
	"series.navLabel": "모음집 안에서 이동",

	"notFound.title": "이 쪽은 찢겨 나갔습니다",
	"notFound.body": "주소가 바뀌었거나 없는 쪽이에요.",
	"notFound.home": "처음으로",

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
	"mdx.download": "내려받기",
	"mdx.fileUnavailable": "파일을 내려받을 수 없습니다",
	"mdx.chartError": "차트 문법 오류",
	"mdx.chartErrorLine": "{line}줄: {message}",
} as const;

export type MessageKey = keyof typeof ko;
export type Messages = Partial<Record<MessageKey, string>>;
