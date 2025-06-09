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
  position: "relative",
  fontSize: "2.5rem",
  fontWeight: "bold",
  marginBottom: "2rem",
  color: "blue.600",
  "&::after": {
    content: "''",
    position: "absolute",
    left: 0,
    bottom: "-4px",
    width: "100%",
    height: "12px",
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='12'><path d='M0 6 Q5 0,10 6 T20 6 T30 6 T40 6 T50 6 T60 6 T70 6 T80 6 T90 6 T100 6 T110 6 T120 6 T130 6 T140 6 T150 6 T160 6 T170 6 T180 6 T190 6 T200 6' stroke='red' fill='transparent' stroke-width='2'/></svg>")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 12px",
    backgroundPosition: "bottom left",
    pointerEvents: "none",
  },
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
