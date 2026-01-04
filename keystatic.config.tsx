import { type Config, config } from "@keystatic/core";
import {
	collectionCollection,
	memoCategoryCollection,
	memoCollection,
	postCategoryCollection,
	postCollection,
	tagCollection,
} from "@/keystatic/collections";

const storage: Config["storage"] =
	process.env.NODE_ENV === "development"
		? { kind: "local" }
		: {
				kind: "github",
				repo: { owner: process.env.NEXT_PUBLIC_KEYSTATIC_OWNER, name: process.env.NEXT_PUBLIC_KEYSTATIC_REPO },
				branchPrefix: "docs/",
			};

export default config({
	storage,
	collections: {
		post: postCollection,
		postCategory: postCategoryCollection,
		memo: memoCollection,
		memoCategory: memoCategoryCollection,
		collection: collectionCollection,
		tag: tagCollection,
	},
	ui: {
		navigation: {
			게시글: ["postCategory", "post"],
			메모: ["memoCategory", "memo"],
			컬렉션: ["collection"],
			태그: ["tag"],
		},
	},
});
