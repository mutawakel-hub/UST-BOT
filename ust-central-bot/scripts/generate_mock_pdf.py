"""
إنشاء ملف PDF تجريبي للبوت العلمي المركزي
يُستخدم لإرسال ملف فعلي عند تحميل الطالب
"""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUTPUT_PATH = "/home/z/my-project/ust-central-bot/scripts/mockup_sample.pdf"

# تسجيل خط يدعم العربية - نستخدم خطاً متاحاً
# محاولة استخدام خطوط متعددة، النجاح بأي منها
font_paths = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]

font_name = "Helvetica"  # fallback
for fp in font_paths:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont("CustomFont", fp))
            font_name = "CustomFont"
            print(f"✅ Using font: {fp}")
            break
        except Exception as e:
            print(f"⚠️ Failed to load {fp}: {e}")

# إنشاء الـ PDF
c = canvas.Canvas(OUTPUT_PATH, pagesize=A4)
width, height = A4

# العنوان
c.setFont(font_name, 24)
c.drawString(2 * cm, height - 3 * cm, "UST Central Bot - Mockup Sample Document")

# خط فاصل
c.setLineWidth(2)
c.line(2 * cm, height - 3.5 * cm, width - 2 * cm, height - 3.5 * cm)

# معلومات الملف
c.setFont(font_name, 14)
y = height - 5 * cm
info_lines = [
    "Document Type: Mockup Sample PDF",
    "Bot: UST Student Bot (Mockup)",
    "University: University of Science and Technology - Yemen",
    "",
    "This is a sample document generated for testing the bot's file delivery",
    "feature. In the production version, actual academic content will be",
    "delivered from the Telegram storage channels.",
    "",
    "Features being tested:",
    "  - File preview screen before download",
    "  - Actual file delivery via Telegram",
    "  - Download counter increment",
    "  - User download history",
    "",
    "Mockup Version: 2.0",
    "Generated: July 2026",
]

for line in info_lines:
    c.drawString(2 * cm, y, line)
    y -= 0.7 * cm

# تذييل
c.setFont(font_name, 10)
c.drawString(2 * cm, 2 * cm, "Page 1 of 1 - UST Central Bot Mockup")

c.save()

# طباعة حجم الملف
size_kb = os.path.getsize(OUTPUT_PATH) / 1024
print(f"\n✅ PDF created: {OUTPUT_PATH}")
print(f"   Size: {size_kb:.2f} KB")
