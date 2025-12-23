import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts, getPreviousPost, getNextPost } from "@/libs/posts";

import { getSeriesBySlug, getPreviousPostInSeries, getNextPostInSeries } from "@/libs/series";
import MDXContent from "@/components/MDXContent";
import fs from "fs";
import path from "path";

interface BlogPostProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// dynamicParams를 false로 설정하여 사전 정의된 경로만 허용
export const dynamicParams = false;

export default async function BlogPost({ params, searchParams }: BlogPostProps) {
  const { slug } = await params;
  const { from } = await searchParams;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // 시리즈에서 온 경우인지 확인
  const fromSeries = typeof from === "string" && from.startsWith("series-") ? from.replace("series-", "") : null;
  const isFromSeries = fromSeries !== null;

  // 이전/다음 게시글 가져오기
  let previousPost = null;
  let nextPost = null;
  let seriesInfo = null;

  if (isFromSeries) {
    // 시리즈에서 온 경우: 시리즈 내 이전/다음 게시글
    seriesInfo = getSeriesBySlug(fromSeries);
    const prevSlug = getPreviousPostInSeries(slug, fromSeries);
    const nextSlug = getNextPostInSeries(slug, fromSeries);

    if (prevSlug) previousPost = getPostBySlug(prevSlug);
    if (nextSlug) nextPost = getPostBySlug(nextSlug);
  } else {
    // 일반 접속: 전체 게시글 기준 이전/다음 게시글
    previousPost = getPreviousPost(slug);
    nextPost = getNextPost(slug);
  }

  // MDX 파일에서 본문 읽어오기
  let mdxSource: string;
  try {
    const filePath = path.join(process.cwd(), ...post.path);
    mdxSource = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Failed to read MDX file: ${slug}`, error);
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link
          href={isFromSeries ? `/series#${fromSeries}` : "/posts"}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {isFromSeries ? "묶음글로 돌아가기" : "블로그로 돌아가기"}
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 게시글 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {post.category}
            </span>
            {isFromSeries && seriesInfo && (
              <span className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full font-medium dark:bg-indigo-900/30 dark:text-indigo-400">
                📚 {seriesInfo.title}
              </span>
            )}
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4 dark:text-gray-100">{post.title}</h1>
          <div className="flex items-center text-gray-600 mb-6">
            <time>
              {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        {/* 게시글 내용 */}
        <MDXContent source={mdxSource} className="prose dark:prose-invert" />
      </article>

      {/* 이전/다음 게시글 네비게이션 */}
      {(previousPost || nextPost) && (
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="flex justify-between items-center">
            {previousPost ? (
              <Link
                href={
                  isFromSeries ? `/posts/${previousPost.slug}?from=series-${fromSeries}` : `/posts/${previousPost.slug}`
                }
                className="group flex flex-col text-left max-w-sm"
              >
                <span className="text-sm text-gray-500 mb-1">
                  {isFromSeries ? "시리즈 이전 게시글" : "이전 게시글"}
                </span>
                <span className="text-blue-600 hover:text-blue-700 font-medium group-hover:underline">
                  ← {previousPost.title}
                </span>
              </Link>
            ) : (
              <div></div>
            )}

            {nextPost ? (
              <Link
                href={isFromSeries ? `/posts/${nextPost.slug}?from=series-${fromSeries}` : `/posts/${nextPost.slug}`}
                className="group flex flex-col text-right max-w-sm"
              >
                <span className="text-sm text-gray-500 mb-1">
                  {isFromSeries ? "시리즈 다음 게시글" : "다음 게시글"}
                </span>
                <span className="text-blue-600 hover:text-blue-700 font-medium group-hover:underline">
                  {nextPost.title} →
                </span>
              </Link>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
