import { css } from "@/pandacss/css";

export const container = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minHeight: "100vh",
  padding: "2rem",
});

export const header = css({
  display: "flex",
  flexDirection: "column",
});

export const backLink = css({
  color: "gray.600",
  textDecoration: "none",
  _hover: {
    textDecoration: "underline",
  },
  marginBottom: "1rem",
});

export const title = css({
  fontSize: "2.5rem",
  fontWeight: "bold",
  color: "blue.500",
});

export const content = css({
  width: "100%",
  backgroundColor: "white",
  padding: "2rem 0rem",
});

export const tagContainer = css({
  display: "flex",
  gap: "0.5rem",
});

export const tag = css({
  padding: "0.25rem 0.5rem",
  backgroundColor: "gray.200",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
});
