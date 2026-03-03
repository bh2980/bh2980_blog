const KEYSTATIC_HOME_PATH = "/keystatic";
const getDefaultBranch = () => process.env.KEYSTATIC_DEFAULT_BRANCH || "main";

export type KeystaticMode = "local" | "github";

type EditPathOptions = {
	mode?: KeystaticMode;
	branch?: string;
};

const encodeSlug = (slug: string) => encodeURIComponent(slug);

const getKeystaticBasePath = ({ mode = "github", branch }: EditPathOptions = {}) => {
	if (mode === "local") return KEYSTATIC_HOME_PATH;
	const resolvedBranch = branch || getDefaultBranch();
	return `/keystatic/branch/${encodeURIComponent(resolvedBranch)}`;
};

const getKeystaticCollectionItemPath = (collection: "post" | "memo", slug: string, options: EditPathOptions = {}) =>
	`${getKeystaticBasePath(options)}/collection/${collection}/item/${encodeSlug(slug)}`;

export const getKeystaticAdminHomePath = () => KEYSTATIC_HOME_PATH;

export const getKeystaticPostEditPath = (slug: string, options?: EditPathOptions) =>
	getKeystaticCollectionItemPath("post", slug, options);

export const getKeystaticMemoEditPath = (slug: string, options?: EditPathOptions) =>
	getKeystaticCollectionItemPath("memo", slug, options);
