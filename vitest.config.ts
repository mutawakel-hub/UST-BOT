import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // خصّص ملفات الاختبارات
    include: ["tests/**/*.test.ts"],
    // استخدم بيئة node (default) — لا نحتاج browser
    environment: "node",
    // عرض النتائج بشكل مفصّل
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/shared/**/*.ts"],
      exclude: ["src/shared/data/**/*.ts", "src/**/*.test.ts"],
    },
  },
});
