import Link from "next/link";
import { getPostList } from "@/lib/posts";
import {
  container,
  title,
  postList,
  postLink,
  postTitle,
  postDescription,
  tagContainer,
  tag,
  noPosts,
} from "./styles";
import { css } from "@/pandacss/css";

export default async function Home() {
  const posts = await getPostList();

  return (
    <div className={container}>
      <h1 className={title}>
        bh2980
        <span className={css({ color: "gray.300" })}>.dev</span>
      </h1>
      <div className={postList}>
        {posts.length > 0 ? (
          posts.map((post) => (
            <Link
              key={post.slug}
              href={`/posts/${post.slug}`}
              className={postLink}
            >
              <h2 className={postTitle}>{post.title}</h2>
              {post.description && (
                <p className={postDescription}>{post.description}</p>
              )}
              <div className={tagContainer}>
                {post.tags.map((tagName) => (
                  <span key={tagName} className={tag}>
                    {tagName}
                  </span>
                ))}
              </div>
            </Link>
          ))
        ) : (
          <p className={noPosts}>No posts found...😭</p>
        )}
      </div>
    </div>
  );
}
