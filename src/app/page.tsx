import { css } from "@/pandacss/css";
import fs from "fs";
import path from "path";
import Link from "next/link";

export default function Home() {
  const posts = fs
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

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        padding: "2rem",
        gap: "2rem",
      })}
    >
      <h1
        className={css({
          fontSize: "2.5rem",
          fontWeight: "bold",
          marginBottom: "2rem",
        })}
      >
        My Blog
      </h1>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "800px",
        })}
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className={css({
              padding: "1rem",
              borderRadius: "0.5rem",
              backgroundColor: "gray.100",
              _hover: {
                backgroundColor: "gray.200",
              },
            })}
          >
            <h2
              className={css({
                fontSize: "1.5rem",
                fontWeight: "semibold",
              })}
            >
              {post.title}
            </h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
