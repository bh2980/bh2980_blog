import Mermaid from "@/components/Mermaid";
import { config, fields, collection } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";

export default config({
  storage: {
    kind: "local",
  },
  collections: {
    posts: collection({
      label: "Posts",
      slugField: "title",
      path: "src/content/posts/*", // 이미지가 글 폴더에 같이 저장되도록 설정됨
      format: { contentField: "content" },
      schema: {
        title: fields.slug({
          name: { label: "제목" },
          slug: {
            label: "슬러그",
            // 💡 제목(name)을 입력할 때 실행되는 슬러그 생성 함수
            generate: (name) =>
              name
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-") // 공백을 하이픈으로
                .replace(/[^\w\uAC00-\uD7A3-]+/g, ""), // 영문, 숫자, 한글(\uAC00-\uD7A3), 하이픈만 남기기

            // 💡 Keystatic 기본 패턴이 한글을 막을 수 있으므로, 패턴을 명시적으로 열어줍니다.
            validation: {
              pattern: {
                // 한글, 영문, 숫자, 하이픈만 허용하는 정규식
                regex: /^[a-z0-9\uAC00-\uD7A3-]+$/,
                message: "슬러그는 한글, 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
              },
            },
          },
        }),
        content: fields.markdoc({
          label: "Content",
          components: {
            // 커스텀 컴포넌트: Mermaid
            Mermaid: block({
              label: "Mermaid 차트",
              schema: {
                chart: fields.text({
                  label: "차트 코드",
                  multiline: true,
                }),
              },
              ContentView: (props) => {
                // props.value.chart에 에디터 입력값이 실시간으로 들어옵니다.
                const chartCode = props.value.chart;

                return (
                  <div
                    style={{
                      padding: "1rem",
                      border: "1px solid #e1e1e1",
                      borderRadius: "8px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div style={{ marginBottom: "8px", fontWeight: "bold", fontSize: "12px", color: "#666" }}>
                      MERMAID PREVIEW
                    </div>
                    {chartCode ? (
                      <Mermaid chart={chartCode} />
                    ) : (
                      <div style={{ color: "#999", fontSize: "14px" }}>코드를 입력하면 차트가 생성됩니다.</div>
                    )}
                  </div>
                );
              },
            }),
          },
        }),
      },
    }),
  },
});
