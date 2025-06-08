import { css } from "@/pandacss/css";

export const container = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minHeight: "100vh",
  padding: "2rem",
});

export const title = css({
  fontSize: "2.5rem",
  fontWeight: "bold",
  marginBottom: "2rem",
  color: "blue.500",
});

export const postList = css({
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  width: "100%",
  maxWidth: "800px",
});

export const postLink = css({
  padding: "1rem",
  borderRadius: "0.5rem",
  backgroundColor: "gray.100",
  _hover: {
    backgroundColor: "gray.200",
  },
});

export const postTitle = css({
  fontSize: "1.5rem",
  fontWeight: "semibold",
});

export const postDescription = css({
  marginTop: "0.5rem",
  color: "gray.600",
});

export const tagContainer = css({
  marginTop: "0.5rem",
  display: "flex",
  gap: "0.5rem",
});

export const tag = css({
  padding: "0.25rem 0.5rem",
  backgroundColor: "gray.200",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
});

export const noPosts = css({
  color: "gray.600",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
  borderRadius: "0.5rem",
  padding: "1rem",
  fontSize: "1.25rem",
  fontWeight: "bold",
});
