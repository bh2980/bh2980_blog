const KEYSTATIC_HOME_PATH = "/keystatic";
const KEYSTATIC_DEFAULT_BRANCH = "main";

export type KeystaticMode = "local" | "github";

type EditPathOptions = {
	mode?: KeystaticMode;
	branch?: string;
};

const encodeSlug = (slug: string) => encodeURIComponent(slug);

const getKeystaticBasePath = ({ mode = "github", branch = KEYSTATIC_DEFAULT_BRANCH }: EditPathOptions = {}) => {
	if (mode === "local") return KEYSTATIC_HOME_PATH;
	return `/keystatic/branch/${encodeURIComponent(branch)}`;
};

const getKeystaticCollectionItemPath = (collection: "post" | "memo", slug: string, options: EditPathOptions = {}) =>
	`${getKeystaticBasePath(options)}/collection/${collection}/item/${encodeSlug(slug)}`;

export const getKeystaticAdminHomePath = () => KEYSTATIC_HOME_PATH;

export const getKeystaticPostEditPath = (slug: string, options?: EditPathOptions) =>
	getKeystaticCollectionItemPath("post", slug, options);

export const getKeystaticMemoEditPath = (slug: string, options?: EditPathOptions) =>
	getKeystaticCollectionItemPath("memo", slug, options);
