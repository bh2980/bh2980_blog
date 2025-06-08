import { css } from "@/pandacss/css";
import Link from "next/link";
import { getPostList } from "@/lib/posts";

export default async function Home() {
  const posts = await getPostList();

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        padding: "2rem",
      })}
    >
      <h1
        className={css({
          fontSize: "2.5rem",
          fontWeight: "bold",
          marginBottom: "2rem",
          color: "blue.500",
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
        {posts.length > 0 ? (
          posts.map((post) => (
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
              {post.description && (
                <p
                  className={css({
                    marginTop: "0.5rem",
                    color: "gray.600",
                  })}
                >
                  {post.description}
                </p>
              )}
              <div
                className={css({
                  marginTop: "0.5rem",
                  display: "flex",
                  gap: "0.5rem",
                })}
              >
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className={css({
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "gray.200",
                      borderRadius: "0.25rem",
                      fontSize: "0.875rem",
                    })}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))
        ) : (
          <p
            className={css({
              color: "gray.600",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "1.25rem",
              fontWeight: "bold",
            })}
          >
            No posts found...😭
          </p>
        )}
      </div>
    </div>
  );
}
