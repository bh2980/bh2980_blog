import { isCollection, isRecordCollection } from "@bh2980/cms/core/collections";
import { schemaOf } from "@bh2980/cms/schema/derive";
import {
	Bookmark,
	BookOpen,
	Box,
	Calendar,
	FileText,
	Folder,
	Image,
	Layers,
	Link,
	List,
	type LucideIcon,
	MessageSquare,
	Newspaper,
	NotebookPen,
	Shapes,
	Star,
	Tag,
	User,
	Users,
	Video,
} from "lucide-react";

/**
 * 컬렉션 정의의 `icon`(lucide 이름)으로 고를 수 있는 아이콘. 모든 아이콘을 싣지 않도록 자주 쓰는 것만 둔다.
 * 없는 이름이면 발행형은 문서, 분류용은 태그 아이콘을 쓴다.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
	bookmark: Bookmark,
	"book-open": BookOpen,
	box: Box,
	calendar: Calendar,
	"file-text": FileText,
	folder: Folder,
	image: Image,
	layers: Layers,
	link: Link,
	list: List,
	"message-square": MessageSquare,
	newspaper: Newspaper,
	"notebook-pen": NotebookPen,
	shapes: Shapes,
	star: Star,
	tag: Tag,
	user: User,
	users: Users,
	video: Video,
};

export const COLLECTION_ICON_NAMES = Object.keys(ICONS);

export function CollectionIcon({ collection }: { collection: string }) {
	const name = isCollection(collection) ? schemaOf(collection).icon : undefined;
	const Icon = (name ? ICONS[name] : undefined) ?? (isRecordCollection(collection) ? Tag : FileText);
	return <Icon />;
}
