import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { readFileSync } from "fs";
import { join } from "path";

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

async function getMDXContent(slug: string) {
  try {
    const filePath = join(process.cwd(), "src", "posts", `${slug}.mdx`);
    const source = readFileSync(filePath, "utf8");

    // frontmatter 제거 (--- 부분)
    const contentWithoutFrontmatter = source.replace(/^---[\s\S]*?---\n/, "");

    return contentWithoutFrontmatter;
  } catch (error) {
    console.error("MDX 파일을 읽을 수 없습니다:", error);
    return null;
  }
}

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const mdxContent = await getMDXContent(slug);

  if (!mdxContent) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link
          href="/blog"
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
          블로그로 돌아가기
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 포스트 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
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
          {mdxContent && (
            <div className="whitespace-pre-wrap">{mdxContent}</div>
          )}
        </div>
      </article>

      {/* 네비게이션 */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <div className="flex justify-between">
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← 모든 포스트 보기
          </Link>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            홈으로 가기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
