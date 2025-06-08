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
    },
  },
});
