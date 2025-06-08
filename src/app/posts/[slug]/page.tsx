import Link from "next/link";
import { getPostContent } from "@/lib/posts";
import { notFound } from "next/navigation";
import {
  container,
  header,
  title,
  backLink,
  content,
  tagContainer,
  tag,
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
    <div className={container}>
      <Link href="/" className={backLink}>
        ← Back to home
      </Link>
      <div className={header}>
        <h1 className={title}>{post.title}</h1>
        <div
          className={css({
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          })}
        >
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          <div className={tagContainer}>
            {post.tags.map((tagName) => (
              <span key={tagName} className={tag}>
                {tagName}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className={content}>{post.content}</div>
    </div>
  );
}
