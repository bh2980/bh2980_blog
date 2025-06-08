import fs from "fs";
import path from "path";

export type Post = {
  slug: string;
  title: string;
};

export function getPostList(): Post[] {
  return fs
    .readdirSync(path.join(process.cwd(), "src/posts"))
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => ({
      slug: file.replace(/\.mdx$/, ""),
      title: file
        .replace(/\.mdx$/, "")
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    }));
}

export function getPostContent(slug: string): string {
  const filePath = path.join(process.cwd(), "src/posts", `${slug}.mdx`);
  return fs.readFileSync(filePath, "utf8");
}
