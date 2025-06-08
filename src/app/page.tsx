import Link from "next/link";
import { getPostList } from "@/lib/posts";
import {
  mainContainer,
  siteTitle,
  postsSection,
  postCard,
  postHeading,
  postSummary,
  postTags,
  postTag,
  emptyState,
} from "./styles";
import { css } from "@/pandacss/css";

export default async function Home() {
  const posts = await getPostList();

  return (
    <main className={mainContainer}>
      <header>
        <h1 className={siteTitle}>
          bh2980
          <span className={css({ color: "gray.300" })}>.dev</span>
        </h1>
      </header>
      <section className={postsSection}>
        {posts.length > 0 ? (
          posts.map((post) => (
            <article key={post.slug} className={postCard}>
              <Link href={`/posts/${post.slug}`}>
                <h2 className={postHeading}>{post.title}</h2>
                {post.description && (
                  <p className={postSummary}>{post.description}</p>
                )}
                <div className={postTags}>
                  {post.tags.map((tagName) => (
                    <span key={tagName} className={postTag}>
                      {tagName}
                    </span>
                  ))}
                </div>
              </Link>
            </article>
          ))
        ) : (
          <p className={emptyState}>No posts found...😭</p>
        )}
      </section>
    </main>
  );
}
