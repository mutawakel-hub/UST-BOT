// ============================================
// 🧪 اختبارات وحدة storage.ts — فحص نوع الملف
// ============================================
// نختبر:
//   - validateUploadedFile() — منطق القبول/الرفض
//   - getFileExtension() — استخراج الامتداد
//   - CONTENT_TYPE_RULES — اكتمال القواعد لكل الأنواع
// ============================================

import { describe, it, expect } from "vitest";
import {
  validateUploadedFile,
  getFileExtension,
  CONTENT_TYPE_RULES,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
} from "../src/shared/storage";

describe("getFileExtension", () => {
  it("extracts extension from filename", () => {
    expect(getFileExtension("document.pdf")).toBe("pdf");
    expect(getFileExtension("video.MP4")).toBe("mp4");
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("returns null for files without extension", () => {
    expect(getFileExtension("README")).toBeNull();
    expect(getFileExtension("")).toBeNull();
    expect(getFileExtension(undefined)).toBeNull();
  });
});

describe("CONTENT_TYPE_RULES — completeness", () => {
  it("has rules for all 8 content types", () => {
    const expectedTypes = [
      "book_theory",
      "book_practical",
      "summary",
      "exam",
      "video",
      "audio",
      "reference",
      "schedule",
    ];
    for (const t of expectedTypes) {
      expect(CONTENT_TYPE_RULES[t]).toBeDefined();
      expect(CONTENT_TYPE_RULES[t].label).toBeTruthy();
      expect(CONTENT_TYPE_RULES[t].emoji).toBeTruthy();
    }
  });

  it("video allows only video extensions", () => {
    expect(CONTENT_TYPE_RULES.video.allowedExtensions).toEqual(
      expect.arrayContaining(["mp4", "mov", "mkv", "webm"])
    );
    expect(CONTENT_TYPE_RULES.video.allowVideo).toBe(true);
    expect(CONTENT_TYPE_RULES.video.allowAudio).toBe(false);
  });

  it("audio allows only audio extensions", () => {
    expect(CONTENT_TYPE_RULES.audio.allowedExtensions).toEqual(
      expect.arrayContaining(["mp3", "m4a", "ogg", "wav"])
    );
    expect(CONTENT_TYPE_RULES.audio.allowVideo).toBe(false);
    expect(CONTENT_TYPE_RULES.audio.allowAudio).toBe(true);
  });

  it("book_practical allows video (for tutorial videos)", () => {
    expect(CONTENT_TYPE_RULES.book_practical.allowVideo).toBe(true);
    // لكنه يقبل أيضاً كل شيء (allowedExtensions = [])
    expect(CONTENT_TYPE_RULES.book_practical.allowedExtensions).toEqual([]);
  });

  it("other types accept everything (no extension restrictions)", () => {
    expect(CONTENT_TYPE_RULES.book_theory.allowedExtensions).toEqual([]);
    expect(CONTENT_TYPE_RULES.book_theory.allowVideo).toBe(false);
    expect(CONTENT_TYPE_RULES.book_theory.allowAudio).toBe(false);

    expect(CONTENT_TYPE_RULES.summary.allowedExtensions).toEqual([]);
    expect(CONTENT_TYPE_RULES.exam.allowedExtensions).toEqual([]);
    expect(CONTENT_TYPE_RULES.reference.allowedExtensions).toEqual([]);
    expect(CONTENT_TYPE_RULES.schedule.allowedExtensions).toEqual([]);
  });
});

describe("validateUploadedFile — video type", () => {
  it("accepts mp4 file for video type", () => {
    const result = validateUploadedFile("video", { file_name: "lecture.mp4" });
    expect(result.valid).toBe(true);
    expect(result.receivedExt).toBe("mp4");
  });

  it("accepts mov file for video type", () => {
    const result = validateUploadedFile("video", { file_name: "tutorial.mov" });
    expect(result.valid).toBe(true);
  });

  it("accepts mkv file for video type", () => {
    const result = validateUploadedFile("video", { file_name: "lesson.mkv" });
    expect(result.valid).toBe(true);
  });

  it("accepts webm file for video type", () => {
    const result = validateUploadedFile("video", { file_name: "clip.webm" });
    expect(result.valid).toBe(true);
  });

  it("rejects PDF for video type", () => {
    const result = validateUploadedFile("video", { file_name: "notes.pdf" });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("نوع الملف غير مقبول");
    expect(result.reason).toContain("notes.pdf");
    expect(result.reason).toContain("MP4");
  });

  it("rejects audio file for video type", () => {
    const result = validateUploadedFile("video", { file_name: "lecture.mp3" });
    expect(result.valid).toBe(false);
  });

  it("rejects image for video type", () => {
    const result = validateUploadedFile("video", { file_name: "photo.jpg" });
    expect(result.valid).toBe(false);
  });

  it("rejects file without extension for video type", () => {
    const result = validateUploadedFile("video", { file_name: "lecture" });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("امتداد");
  });
});

describe("validateUploadedFile — audio type", () => {
  it("accepts mp3 file for audio type", () => {
    const result = validateUploadedFile("audio", { file_name: "lecture.mp3" });
    expect(result.valid).toBe(true);
  });

  it("accepts m4a, ogg, wav for audio type", () => {
    expect(validateUploadedFile("audio", { file_name: "f.m4a" }).valid).toBe(true);
    expect(validateUploadedFile("audio", { file_name: "f.ogg" }).valid).toBe(true);
    expect(validateUploadedFile("audio", { file_name: "f.wav" }).valid).toBe(true);
  });

  it("rejects video file for audio type", () => {
    const result = validateUploadedFile("audio", { file_name: "lecture.mp4" });
    expect(result.valid).toBe(false);
  });

  it("rejects PDF for audio type", () => {
    const result = validateUploadedFile("audio", { file_name: "notes.pdf" });
    expect(result.valid).toBe(false);
  });
});

describe("validateUploadedFile — book_practical (accepts everything + video)", () => {
  it("accepts PDF for book_practical", () => {
    const result = validateUploadedFile("book_practical", { file_name: "manual.pdf" });
    expect(result.valid).toBe(true);
  });

  it("accepts DOCX for book_practical", () => {
    const result = validateUploadedFile("book_practical", { file_name: "lab.docx" });
    expect(result.valid).toBe(true);
  });

  it("accepts video for book_practical (tutorial, experiment, etc.)", () => {
    const result = validateUploadedFile("book_practical", { file_name: "flutter_tutorial.mp4" });
    expect(result.valid).toBe(true);
  });

  it("accepts any other extension for book_practical", () => {
    expect(validateUploadedFile("book_practical", { file_name: "f.zip" }).valid).toBe(true);
    expect(validateUploadedFile("book_practical", { file_name: "f.png" }).valid).toBe(true);
    expect(validateUploadedFile("book_practical", { file_name: "f.xlsx" }).valid).toBe(true);
  });
});

describe("validateUploadedFile — other types accept everything", () => {
  it("book_theory accepts PDF, DOCX, EPUB, TXT, anything", () => {
    expect(validateUploadedFile("book_theory", { file_name: "f.pdf" }).valid).toBe(true);
    expect(validateUploadedFile("book_theory", { file_name: "f.docx" }).valid).toBe(true);
    expect(validateUploadedFile("book_theory", { file_name: "f.epub" }).valid).toBe(true);
    expect(validateUploadedFile("book_theory", { file_name: "f.txt" }).valid).toBe(true);
    expect(validateUploadedFile("book_theory", { file_name: "f.unknownext" }).valid).toBe(true);
  });

  it("summary accepts any extension", () => {
    expect(validateUploadedFile("summary", { file_name: "f.pdf" }).valid).toBe(true);
    expect(validateUploadedFile("summary", { file_name: "f.docx" }).valid).toBe(true);
    expect(validateUploadedFile("summary", { file_name: "f.md" }).valid).toBe(true);
  });

  it("exam accepts any extension including images", () => {
    expect(validateUploadedFile("exam", { file_name: "f.pdf" }).valid).toBe(true);
    expect(validateUploadedFile("exam", { file_name: "f.jpg" }).valid).toBe(true);
    expect(validateUploadedFile("exam", { file_name: "f.png" }).valid).toBe(true);
  });

  it("reference accepts any extension", () => {
    expect(validateUploadedFile("reference", { file_name: "f.pdf" }).valid).toBe(true);
    expect(validateUploadedFile("reference", { file_name: "f.url" }).valid).toBe(true);
  });

  it("schedule accepts any extension", () => {
    expect(validateUploadedFile("schedule", { file_name: "f.pdf" }).valid).toBe(true);
    expect(validateUploadedFile("schedule", { file_name: "f.xlsx" }).valid).toBe(true);
    expect(validateUploadedFile("schedule", { file_name: "f.png" }).valid).toBe(true);
  });
});

describe("validateUploadedFile — unknown type defaults to accept", () => {
  it("accepts any file for unknown content type", () => {
    const result = validateUploadedFile("unknown_type", { file_name: "file.xyz" });
    expect(result.valid).toBe(true);
  });
});

describe("VIDEO_EXTENSIONS and AUDIO_EXTENSIONS", () => {
  it("VIDEO_EXTENSIONS contains common video formats", () => {
    expect(VIDEO_EXTENSIONS).toContain("mp4");
    expect(VIDEO_EXTENSIONS).toContain("mov");
    expect(VIDEO_EXTENSIONS).toContain("mkv");
    expect(VIDEO_EXTENSIONS).toContain("webm");
  });

  it("AUDIO_EXTENSIONS contains common audio formats", () => {
    expect(AUDIO_EXTENSIONS).toContain("mp3");
    expect(AUDIO_EXTENSIONS).toContain("m4a");
    expect(AUDIO_EXTENSIONS).toContain("ogg");
    expect(AUDIO_EXTENSIONS).toContain("wav");
  });
});
