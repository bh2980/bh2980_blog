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
        backgroundColor: "gray.100",
        color: "gray.900",
      })}
    >
      <h1
        className={css({
          fontSize: "2xl",
          fontWeight: "bold",
          marginBottom: "1rem",
        })}
      >
        Panda CSS 테스트
      </h1>
      <p
        className={css({
          fontSize: "lg",
          color: "blue.600",
        })}
      >
        Panda CSS가 성공적으로 적용되었습니다!
      </p>
    </div>
  );
}
