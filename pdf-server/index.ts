// Worker بسيط لتقديم ملف PDF تجريبي للبوتين
// يمكن الوصول إليه عبر: https://ust-pdf-server.<subdomain>.workers.dev/sample.pdf

const PDF_BYTES = Uint8Array.from(atob(`
JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAw
IG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDEvTWVkaWFCb3hbMCAwIDU5NSA4
NDJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8
PC9Gb250PDwvRjEgNCAwIFI+Pj4+Pi9Db250ZW50cyA1IDAgUi9NZWRpYUJveFswIDAgNTk1IDg0
Ml0+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9I
ZWx2ZXRpY2EvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nPj4KZW5kb2JqCjUgMCBvYmoKPDwvTGVu
Z3RoIDE2MD4+CnN0cmVhbQpCVC9GMSAxOCBUZgo3MiA3MDAgVGQKVVNUIENlbnRyYWwgQm90IC0g
TW9ja3VwIFNhbXBsZSBEb2N1bWVudApFVC9GMSAxMiBUZgo1MCA2NTAgVGQKVGhpcyBpcyBhIHNh
bXBsZSBkb2N1bWVudCBmb3IgdGVzdGluZyB0aGUgYm90J3MgZmlsZSBkZWxpdmVyeSBmZWF0dXJl
LgpFVC9GMSAxMiBUZwo1MCA1ODAgVGQKSW4gcHJvZHVjdGlvbiwgYWN0dWFsIGFjYWRlbWljIGNv
bnRlbnQgd2lsbCBiZSBkZWxpdmVyZWQuCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAw
MDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMDkgMDAwMDAgbgowMDAwMDAwMDU4IDAwMDAwIG4KMDAw
MDAwMDExNSAwMDAwMCBuCjAwMDAwMDAxOTQgMDAwMDAgbgowMDAwMDAwMzAwIDAwMDAwIG4KdHJh
aWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUi9JbmZvIDEgMCBSPj4Kc3RhcnR4cmVmCjQ1MAolRU9G
`), c => c.charCodeAt(0));

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Headers CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // فحص الصحة
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ملف PDF
    if (url.pathname === "/sample.pdf" || url.pathname === "/") {
      return new Response(PDF_BYTES, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="UST_Mockup_Sample.pdf"',
          "Content-Length": String(PDF_BYTES.length),
          "Cache-Control": "public, max-age=86400",
          ...corsHeaders,
        },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
