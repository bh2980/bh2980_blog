import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemoBySlug, getAllMemos } from "@/lib/memos";
import MDXContent from "@/components/MDXContent";
import fs from "fs";
import path from "path";

interface MemoPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const memos = getAllMemos();
  return memos.map((memo) => ({
    slug: memo.slug,
    path: memo.path,
  }));
}

export default async function MemoPost({ params }: MemoPostProps) {
  const { slug } = await params;
  const memo = getMemoBySlug(slug);

  if (!memo) {
    notFound();
  }

  // MDX 파일에서 본문 읽어오기
  let mdxSource: string;
  try {
    const filePath = path.join(process.cwd(), ...(memo.path ?? []));
    mdxSource = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`Failed to read MDX file: ${slug}`, error);
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link href="/memo" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
          <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          메모장으로 돌아가기
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 메모 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {memo.category}
            </span>
            <time className="text-gray-500">
              {new Date(memo.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-100">{memo.title}</h1>

          <div className="flex flex-wrap gap-2">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        {/* 메모 내용 */}
        <MDXContent source={mdxSource} className="prose dark:prose-invert" />
      </article>
    </div>
  );
}
