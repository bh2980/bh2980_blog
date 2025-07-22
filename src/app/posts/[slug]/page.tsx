import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPostBySlug,
  getAllPosts,
  getPreviousPost,
  getNextPost,
} from "@/lib/posts";
import {
  getSeriesBySlug,
  getPreviousPostInSeries,
  getNextPostInSeries,
} from "@/lib/series";
import { MDXRemote } from "next-mdx-remote/rsc";
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

export default async function BlogPost({
  params,
  searchParams,
}: BlogPostProps) {
  const { slug } = await params;
  const { from } = await searchParams;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // 시리즈에서 온 경우인지 확인
  const fromSeries =
    typeof from === "string" && from.startsWith("series-")
      ? from.replace("series-", "")
      : null;
  const isFromSeries = fromSeries !== null;

  // 이전/다음 포스트 가져오기
  let previousPost = null;
  let nextPost = null;
  let seriesInfo = null;

  if (isFromSeries) {
    // 시리즈에서 온 경우: 시리즈 내 이전/다음 포스트
    seriesInfo = getSeriesBySlug(fromSeries);
    const prevSlug = getPreviousPostInSeries(slug, fromSeries);
    const nextSlug = getNextPostInSeries(slug, fromSeries);

    if (prevSlug) previousPost = getPostBySlug(prevSlug);
    if (nextSlug) nextPost = getPostBySlug(nextSlug);
  } else {
    // 일반 접속: 전체 포스트 기준 이전/다음 포스트
    previousPost = getPreviousPost(slug);
    nextPost = getNextPost(slug);
  }

  // MDX 파일에서 본문 읽어오기
  let mdxSource: string;
  try {
    const filePath = path.join(
      process.cwd(),
      "content",
      "posts",
      `${slug}.mdx`
    );
    const fileContent = fs.readFileSync(filePath, "utf8");

    // frontmatter 제거 (--- 사이의 내용 제거)
    mdxSource = fileContent.replace(/^---[\s\S]*?---\n/, "");
  } catch (error) {
    console.error(`Failed to read MDX file: ${slug}`, error);
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link
          href={isFromSeries ? "/series" : "/posts"}
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            className="mr-1 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {isFromSeries ? "묶음글로 돌아가기" : "블로그로 돌아가기"}
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 포스트 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
          {isFromSeries && seriesInfo && (
            <div className="mb-4">
              <span className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full font-medium">
                📚 {seriesInfo.title}
              </span>
            </div>
          )}

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>
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
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        {/* 포스트 내용 */}
        <div className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <MDXRemote source={mdxSource} />
        </div>
      </article>

      {/* 이전/다음 포스트 네비게이션 */}
      {(previousPost || nextPost) && (
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="flex justify-between items-center">
            {previousPost ? (
              <Link
                href={
                  isFromSeries
                    ? `/posts/${previousPost.slug}?from=series-${fromSeries}`
                    : `/posts/${previousPost.slug}`
                }
                className="group flex flex-col text-left max-w-sm"
              >
                <span className="text-sm text-gray-500 mb-1">
                  {isFromSeries ? "시리즈 이전 포스트" : "이전 포스트"}
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
                href={
                  isFromSeries
                    ? `/posts/${nextPost.slug}?from=series-${fromSeries}`
                    : `/posts/${nextPost.slug}`
                }
                className="group flex flex-col text-right max-w-sm"
              >
                <span className="text-sm text-gray-500 mb-1">
                  {isFromSeries ? "시리즈 다음 포스트" : "다음 포스트"}
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
