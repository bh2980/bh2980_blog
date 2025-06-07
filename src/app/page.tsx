import { css } from "@/pandacss/css";

export default function Home() {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        gap: "2rem",
      })}
    >
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "100",
        })}
      >
        Pretendard 100
      </h1>
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "300",
        })}
      >
        Pretendard 300
      </h1>
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "500",
        })}
      >
        Pretendard 500
      </h1>
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "700",
        })}
      >
        Pretendard 700
      </h1>
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "900",
        })}
      >
        Pretendard 900
      </h1>
    </div>
  );
}
