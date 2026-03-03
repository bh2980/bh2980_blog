const KEYSTATIC_BRANCH = "main";
const KEYSTATIC_BASE_PATH = `/keystatic/branch/${encodeURIComponent(KEYSTATIC_BRANCH)}`;

const encodeSlug = (slug: string) => encodeURIComponent(slug);

const getKeystaticCollectionItemPath = (collection: "post" | "memo", slug: string) =>
	`${KEYSTATIC_BASE_PATH}/collection/${collection}/item/${encodeSlug(slug)}`;

export const getKeystaticAdminHomePath = () => KEYSTATIC_BASE_PATH;

export const getKeystaticPostEditPath = (slug: string) => getKeystaticCollectionItemPath("post", slug);

export const getKeystaticMemoEditPath = (slug: string) => getKeystaticCollectionItemPath("memo", slug);
