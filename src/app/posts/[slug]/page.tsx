import Link from "next/link";
import { getPostContent } from "@/lib/posts";
import { notFound } from "next/navigation";
import {
  mainContainer,
  postHeader,
  postTitle,
  backLink,
  postTags,
  postTag,
} from "./styles";
import { css } from "@/pandacss/css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostContent(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className={mainContainer}>
      <article className={css({ maxWidth: "800px" })}>
        <header className={postHeader}>
          <Link href="/" className={backLink}>
            ← Back to home
          </Link>
          <h1 className={postTitle}>{post.title}</h1>
          <div
            className={css({
              display: "flex",
              gap: "1rem",
            })}
          >
            <time dateTime={new Date(post.createdAt).toISOString()}>
              {new Date(post.createdAt).toLocaleDateString()}
            </time>
            <div className={postTags}>
              {post.tags.map((tagName) => (
                <span key={tagName} className={postTag}>
                  {tagName}
                </span>
              ))}
            </div>
          </div>
        </header>
        <section className="prose">{post.content}</section>
      </article>
    </main>
  );
}
