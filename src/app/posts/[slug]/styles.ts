import { css } from "@/pandacss/css";

export const mainContainer = css({
  padding: "2rem",
  minHeight: "100vh",
  backgroundColor: "gray.50",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

export const postHeader = css({
  marginBottom: "2rem",
});

export const postTitle = css({
  fontSize: "2.5rem",
  fontWeight: "bold",
  marginTop: "1rem",
  marginBottom: "1rem",
  color: "gray.900",
});

export const backLink = css({
  color: "blue.600",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
});

export const postContent = css({
  fontSize: "1.125rem",
  lineHeight: "1.75",
  color: "gray.800",
  "& > *": {
    marginBottom: "1.5rem",
  },
  "& > *:last-child": {
    marginBottom: "0",
  },
});

export const postTags = css({
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
