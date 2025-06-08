import fs from "fs";
import path from "path";
import { compileMDX } from "next-mdx-remote/rsc";
import { ReactElement } from "react";
import rehypePrettyCode from "rehype-pretty-code";

interface Frontmatter {
  slug: string;
  title: string;
  description?: string;
  createdAt: number;
  tags: string[];
}

export interface Post extends Frontmatter {
  content: ReactElement;
}

export async function getPostList(): Promise<Frontmatter[]> {
  const files = fs
    .readdirSync(path.join(process.cwd(), "src/posts"))
    .filter((file) => file.endsWith(".mdx"));

  const posts = await Promise.all(
    files.map(async (file) => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/posts", file),
        "utf8"
      );
      const { frontmatter } = await compileMDX<Frontmatter>({
        source,
        options: {
          parseFrontmatter: true,
        },
      });

      return {
        slug: file.replace(/\.mdx$/, ""),
        title:
          frontmatter.title ||
          file
            .replace(/\.mdx$/, "")
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
        description: frontmatter.description || "",
        createdAt: frontmatter.createdAt || Date.now(),
        tags: frontmatter.tags || [],
      };
    })
  );

  return posts.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPostContent(slug: string): Promise<Post> {
  const filePath = path.join(process.cwd(), "src/posts", `${slug}.mdx`);
  const source = fs.readFileSync(filePath, "utf8");
  const { frontmatter, content } = await compileMDX<Frontmatter>({
    source,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        rehypePlugins: [[rehypePrettyCode, { theme: "one-dark-pro" }]],
      },
    },
  });

  return {
    slug,
    title:
      frontmatter.title ||
      slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    description: frontmatter.description || "",
    createdAt: frontmatter.createdAt || Date.now(),
    tags: frontmatter.tags || [],
    content,
  };
}
