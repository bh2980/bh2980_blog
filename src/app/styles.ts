import { css } from "@/pandacss/css";

export const mainContainer = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minHeight: "100vh",
  height: "100vh",
  padding: "2rem",
  backgroundColor: "gray.50",
});

export const siteTitle = css({
  fontSize: "2.5rem",
  fontWeight: "bold",
  marginBottom: "2rem",
  color: "blue.600",
});

export const postsSection = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  width: "100%",
  maxWidth: "800px",
  height: "100%",
  flex: 1,
});

export const postCard = css({
  padding: "1.5rem",
  borderRadius: "1rem",
  backgroundColor: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  transition: "all 0.2s ease-in-out",
  _hover: {
    backgroundColor: "blue.50/70",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    transform: "translateY(-2px)",
  },
});

export const postHeading = css({
  fontSize: "1.5rem",
  fontWeight: "bold",
  color: "gray.900",
  marginBottom: "0.5rem",
});

export const postSummary = css({
  fontSize: "1.125rem",
  lineHeight: "1.75",
  color: "gray.800",
  marginTop: "0.5rem",
});

export const postTags = css({
  marginTop: "1rem",
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
});

export const postTag = css({
  backgroundColor: "blue.100",
  color: "blue.800",
  padding: "0.25rem 0.75rem",
  borderRadius: "9999px",
  fontSize: "0.875rem",
});

export const emptyState = css({
  color: "gray.600",
  fontSize: "1.25rem",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
  height: "100%",
});
