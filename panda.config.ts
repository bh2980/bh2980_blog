import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        fonts: {
          pretendard: {
            value: "var(--font-pretendard)",
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  // Global CSS styles
  globalCss: {
    ".prose": {
      "& h1": {
        fontSize: "2.25rem",
        fontWeight: "700",
        marginTop: "2rem",
        marginBottom: "1rem",
      },
      "& h2": {
        fontSize: "1.875rem",
        fontWeight: "600",
        marginTop: "1.75rem",
        marginBottom: "0.75rem",
      },
      "& h3": {
        fontSize: "1.5rem",
        fontWeight: "600",
        marginTop: "1.5rem",
        marginBottom: "0.5rem",
      },
      "& p": { marginBottom: "1.25rem", lineHeight: "1.75" },
      "& ul": {
        listStyleType: "disc",
        paddingLeft: "1.5rem",
        marginBottom: "1.25rem",
      },
      "& ol": {
        listStyleType: "decimal",
        paddingLeft: "1.5rem",
        marginBottom: "1.25rem",
      },
      "& li": { marginBottom: "0.5rem" },
      "& blockquote": {
        borderLeft: "4px solid #e5e7eb",
        paddingLeft: "1rem",
        fontStyle: "italic",
        margin: "1.5rem 0",
      },
      "& code": {
        fontSize: "0.875rem",
      },
      "& pre": {
        borderRadius: "0.5rem",
        overflowX: "auto",
      },
      "& a": {
        color: "#2563eb",
        textDecoration: "underline",
        "&:hover": {
          color: "#1d4ed8",
        },
      },
      "& img": {
        maxWidth: "100%",
        height: "auto",
        margin: "1.5rem 0",
      },
      "& figure[data-rehype-pretty-code-figure]": {
        marginBottom: "1.5rem",

        "&:has(figcaption[data-rehype-pretty-code-title])": {
          "& figcaption[data-rehype-pretty-code-title]": {
            backgroundColor: "rgb(36, 36, 36)",
            padding: "0.7rem 1rem",
            color: "rgb(207, 207, 207)",
            borderRadius: "16px 16px 0 0",
            borderBottom: "1px solid rgb(51 65 85)",
          },
          "& pre": {
            borderRadius: "0 0 16px 16px",
          },
        },
        "& pre": {
          paddingTop: "1rem",
          paddingBottom: "1rem",
          borderRadius: "16px",
          overflow: "auto",
          "& code[data-line-numbers]": {
            counterReset: "line",
          },
          "& code[data-line-numbers] > [data-line]::before": {
            counterIncrement: "line",
            content: "counter(line)",
            display: "inline-block",
            width: "0.75rem",
            marginRight: "2rem",
            textAlign: "right",
            color: "gray",
          },
          "& code[data-line-numbers-max-digits='2'] > [data-line]::before": {
            width: "1.25rem",
          },
          "& code[data-line-numbers-max-digits='3'] > [data-line]::before": {
            width: "1.75rem",
          },
          "& span[data-line]": {
            paddingLeft: "1rem",
          },
          "& span[data-highlighted-line]": {
            backgroundColor: "rgb(51 65 85)",
            borderLeft: "3px solid rgb(59 130 246)",
            paddingLeft: "calc(1rem - 3px)",
          },
        },
      },
      "& :not(pre) > code": {
        padding: "0.2rem 0.5rem",
        borderRadius: "0.5rem",
        marginRight: "0.25rem",
      },
    },
  },
});
