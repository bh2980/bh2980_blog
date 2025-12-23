import { fields } from "@keystatic/core";

export const slug = (nameLabel: string = '제목', slugLabel: string = '슬러그') =>
  fields.slug({
    name: { label: nameLabel },
    slug: {
      label: slugLabel,
      generate: (name) =>
        name
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-") // 공백을 하이픈으로
          .replace(/[^\w\uAC00-\uD7A3-]+/g, ""), // 영문, 숫자, 한글(\uAC00-\uD7A3), 하이픈만 남기기
      validation: {
        pattern: {
          regex: /^[a-z0-9\uAC00-\uD7A3-]+$/,
          message: `${slugLabel}는 한글, 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.`,
        },
      },
    },
  });
