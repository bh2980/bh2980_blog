import { type Config, config } from "@keystatic/core";
import { collectionCollection, memoCollection, postCollection, tagCollection } from "@/keystatic/collections";

const storage: Config["storage"] =
	process.env.NODE_ENV === "development"
		? { kind: "local" }
		: { kind: "github", repo: { owner: "bh2980", name: "bh2980_blog" } };

export default config({
	storage,
	collections: {
		post: postCollection,
		memo: memoCollection,
		collection: collectionCollection,
		tag: tagCollection,
	},
});
