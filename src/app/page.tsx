import { css } from "@/pandacss/css";
import Link from "next/link";
import { getPostList } from "@/lib/posts";

export default function Home() {
  const posts = getPostList();

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
        bh2980.dev
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
