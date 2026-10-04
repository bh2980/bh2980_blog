/** 공개 화면 블록이 독자에게 보이는 고정 문구. 사이트 언어(`context.locale`)에 맞춰 고른다. */
export interface BlockLabels {
	readonly calloutNote: string;
	readonly calloutTip: string;
	readonly calloutInfo: string;
	readonly calloutWarning: string;
	readonly calloutDanger: string;
	/** 제목이 없는 접기 블록의 제목. */
	readonly collapsibleFallback: string;
	readonly chartError: string;
	readonly chartErrorLine: (line: number, message: string) => string;
}

const EN: BlockLabels = {
	calloutNote: "Note",
	calloutTip: "Tip",
	calloutInfo: "Info",
	calloutWarning: "Warning",
	calloutDanger: "Danger",
	collapsibleFallback: "Show more",
	chartError: "Chart syntax error",
	chartErrorLine: (line, message) => `Line ${line}: ${message}`,
};

const KO: BlockLabels = {
	calloutNote: "노트",
	calloutTip: "팁",
	calloutInfo: "정보",
	calloutWarning: "경고",
	calloutDanger: "위험",
	collapsibleFallback: "펼치기",
	chartError: "차트 문법 오류",
	chartErrorLine: (line, message) => `${line}줄: ${message}`,
};

const JA: BlockLabels = {
	calloutNote: "ノート",
	calloutTip: "ヒント",
	calloutInfo: "情報",
	calloutWarning: "警告",
	calloutDanger: "危険",
	collapsibleFallback: "開く",
	chartError: "グラフの構文エラー",
	chartErrorLine: (line, message) => `${line}行目: ${message}`,
};

const BY_LANGUAGE: Readonly<Record<string, BlockLabels>> = { en: EN, ko: KO, ja: JA };

/** 언어 코드(`ko`·`ko-KR`·`en` …)의 문구. 모르는 언어는 영어다. */
export const blockLabels = (locale?: string): BlockLabels =>
	BY_LANGUAGE[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? EN;
