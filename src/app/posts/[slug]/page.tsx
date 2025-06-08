import { css } from "@/pandacss/css";
import fs from "fs";
import path from "path";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";

export default function Post({ params }: { params: { slug: string } }) {
  const filePath = path.join(process.cwd(), "src/posts", `${params.slug}.mdx`);
  const source = fs.readFileSync(filePath, "utf8");

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
            marginBottom: "2rem",
          },
          "& p": {
            marginBottom: "1rem",
            lineHeight: "1.6",
          },
        })}
      >
        <MDXRemote source={source} />
      </article>
    </div>
  );
}
