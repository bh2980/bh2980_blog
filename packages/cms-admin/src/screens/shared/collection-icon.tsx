import { isCollection, isRecordCollection, schemaOf } from "@bh2980/cms/client";
import {
	Bookmark,
	BookOpen,
	Box,
	Calendar,
	ChartColumn,
	ChevronsUpDown,
	Columns2,
	FileText,
	Folder,
	Image,
	Layers,
	Link,
	List,
	type LucideIcon,
	MessageSquare,
	MessageSquareWarning,
	Newspaper,
	NotebookPen,
	Plug,
	Puzzle,
	Settings,
	Shapes,
	Sigma,
	Sparkles,
	SquareStack,
	Star,
	Tag,
	User,
	Users,
	Video,
	Workflow,
} from "lucide-react";

/**
 * 컬렉션 정의의 `icon`·플러그인 사이드바 항목의 `icon`·블록 정의의 `editor.icon`(lucide 이름)으로 고를 수 있는 아이콘.
 * 모든 아이콘을 싣지 않도록 자주 쓰는 것만 둔다. 컬렉션은 없는 이름이면 발행형은 문서, 분류용은 태그 아이콘을 쓴다.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
	bookmark: Bookmark,
	"book-open": BookOpen,
	box: Box,
	calendar: Calendar,
	"chart-column": ChartColumn,
	"chevrons-up-down": ChevronsUpDown,
	"columns-2": Columns2,
	"file-text": FileText,
	folder: Folder,
	image: Image,
	layers: Layers,
	link: Link,
	list: List,
	"message-square": MessageSquare,
	"message-square-warning": MessageSquareWarning,
	newspaper: Newspaper,
	"notebook-pen": NotebookPen,
	plug: Plug,
	puzzle: Puzzle,
	settings: Settings,
	shapes: Shapes,
	sigma: Sigma,
	sparkles: Sparkles,
	"square-stack": SquareStack,
	star: Star,
	tag: Tag,
	user: User,
	users: Users,
	video: Video,
	workflow: Workflow,
};

export const COLLECTION_ICON_NAMES = Object.keys(ICONS);

export function CollectionIcon({ collection }: { collection: string }) {
	const name = isCollection(collection) ? schemaOf(collection).icon : undefined;
	const Icon = (name ? ICONS[name] : undefined) ?? (isRecordCollection(collection) ? Tag : FileText);
	return <Icon />;
}

/** 이름으로 고른 아이콘 컴포넌트. 모르는 이름이면 `undefined`다. */
export const iconByName = (name: string | undefined): LucideIcon | undefined => (name ? ICONS[name] : undefined);

/** 이름으로 고른 아이콘. 모르는 이름이면 플러그 아이콘이다. */
export function NamedIcon({ name }: { name?: string }) {
	const Icon = (name ? ICONS[name] : undefined) ?? Plug;
	return <Icon />;
}
