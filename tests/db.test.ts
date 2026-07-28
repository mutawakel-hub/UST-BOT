// ============================================
// 🧪 اختبارات وحدة db.ts
// ============================================
// نختبر:
//   1. URL encoding في eq/neq/inList (حرج للعربية والمسافات)
//   2. order() helper
// ============================================

import { describe, it, expect } from "vitest";
import { eq, neq, inList, order } from "../src/shared/db";

describe("URL encoding helpers", () => {
  describe("eq()", () => {
    it("encodes Arabic characters", () => {
      // أحمد = %D8%A3%D8%AD%D9%85%D8%AF
      expect(eq("name", "أحمد")).toBe("name=eq.%D8%A3%D8%AD%D9%85%D8%AF");
    });

    it("encodes spaces", () => {
      expect(eq("name", "John Doe")).toBe("name=eq.John%20Doe");
    });

    it("encodes special characters", () => {
      // & = # ? يجب ترميزها لتفادي كسر query string
      expect(eq("name", "a&b=c")).toBe("name=eq.a%26b%3Dc");
    });

    it("encodes Arabic with spaces", () => {
      expect(eq("title", "مقدمة في الطب")).toBe(
        "title=eq.%D9%85%D9%82%D8%AF%D9%85%D8%A9%20%D9%81%D9%8A%20%D8%A7%D9%84%D8%B7%D8%A8"
      );
    });

    it("handles numbers", () => {
      expect(eq("id", 123)).toBe("id=eq.123");
    });

    it("handles booleans as JSON", () => {
      expect(eq("is_active", true)).toBe("id=eq.true".replace("id", "is_active"));
    });

    it("handles null values as JSON", () => {
      // null يُحول إلى JSON.stringify → "null"
      expect(eq("name", null)).toBe("name=eq.null");
    });
  });

  describe("neq()", () => {
    it("encodes Arabic characters", () => {
      expect(neq("status", "مرفوض")).toBe(
        "status=neq.%D9%85%D8%B1%D9%81%D9%88%D8%B6"
      );
    });

    it("encodes spaces", () => {
      expect(neq("name", "John Doe")).toBe("name=neq.John%20Doe");
    });
  });

  describe("inList()", () => {
    it("encodes each value", () => {
      const result = inList("id", [1, 2, 3]);
      expect(result).toBe("id=in.(%221%22,%222%22,%223%22)");
    });

    it("encodes Arabic values", () => {
      const result = inList("name", ["أحمد", "سارة"]);
      expect(result).toContain("%D8%A3%D8%AD%D9%85%D8%AF");
      expect(result).toContain("%D8%B3%D8%A7%D8%B1%D8%A9");
    });

    it("handles empty array", () => {
      const result = inList("id", []);
      expect(result).toBe("id=in.()");
    });

    it("handles single value", () => {
      const result = inList("id", [42]);
      expect(result).toBe("id=in.(%2242%22)");
    });
  });

  describe("order()", () => {
    it("returns ascending order by default", () => {
      expect(order("created_at")).toBe("created_at.asc");
    });

    it("returns descending order when ascending=false", () => {
      expect(order("created_at", false)).toBe("created_at.desc");
    });

    it("handles column names with table prefix", () => {
      expect(order("content.download_count", false)).toBe(
        "content.download_count.desc"
      );
    });
  });
});

describe("PostgREST filter composition patterns", () => {
  it("composes multiple filters with &", () => {
    const filters = [
      "status=eq.pending",
      eq("subject_id", 123),
    ].join("&");
    expect(filters).toBe("status=eq.pending&subject_id=eq.123");
  });

  it("composes filter + order", () => {
    const filter = eq("is_active", "true");
    const orderClause = order("created_at", false);
    // في PostgREST، الـ order يُمرر كـ query param منفصل
    expect(filter).toBe("is_active=eq.true");
    expect(orderClause).toBe("created_at.desc");
  });
});
