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
		: { kind: "github", repo: { owner: "bh2980", name: "bh2980_blog" } };

export default config({
	storage,
	collections: {
		//공통
		tag: tagCollection,
		collection: collectionCollection,
		//게시글
		postCategory: postCategoryCollection,
		post: postCollection,
		//메모
		memoCategory: memoCategoryCollection,
		memo: memoCollection,
	},
	ui: {
		navigation: {
			게시글: ["postCategory", "post"],
			메모: ["memoCategory", "memo"],
			공통: ["collection", "tag"],
		},
	},
});
