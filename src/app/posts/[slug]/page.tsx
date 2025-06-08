import { css } from "@/pandacss/css";
import Link from "next/link";
import { getPostContent } from "@/lib/posts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Post({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostContent(slug);

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
      <div
        className={css({
          width: "100%",
          maxWidth: "800px",
          marginBottom: "2rem",
        })}
      >
        <Link
          href="/"
          className={css({
            display: "inline-block",
            padding: "0.5rem 1rem",
            backgroundColor: "gray.100",
            borderRadius: "0.25rem",
            marginBottom: "2rem",
            _hover: {
              backgroundColor: "gray.200",
            },
          })}
        >
          ← Back to Home
        </Link>
      </div>
      <article
        className={css({
          width: "100%",
          maxWidth: "800px",
          "& h1": {
            fontSize: "2.5rem",
            fontWeight: "bold",
            marginBottom: "1rem",
          },
          "& p": {
            marginBottom: "1rem",
            lineHeight: "1.6",
          },
        })}
      >
        <h1>{post.title}</h1>
        {post.description && (
          <p
            className={css({
              fontSize: "1.25rem",
              color: "gray.600",
              marginBottom: "2rem",
            })}
          >
            {post.description}
          </p>
        )}
        <div
          className={css({
            display: "flex",
            gap: "1rem",
            marginBottom: "2rem",
            alignItems: "center",
          })}
        >
          <time
            className={css({
              color: "gray.600",
            })}
          >
            {new Date(post.createdAt).toLocaleDateString()}
          </time>
          <div
            className={css({
              display: "flex",
              gap: "0.5rem",
            })}
          >
            {post.tags.map((tag) => (
              <span
                key={tag}
                className={css({
                  padding: "0.25rem 0.5rem",
                  backgroundColor: "gray.100",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem",
                })}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {post.content}
      </article>
    </div>
  );
}
