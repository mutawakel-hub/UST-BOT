"""
سكريبت إضافة GitHub Actions Secrets بشكل آمن
يقوم بتشفير الـ secrets بمفتاح PGP العام للمستودع ثم يرفعها
"""
import json
import sys
import urllib.request
import urllib.parse
from base64 import b64encode
from nacl import public, encoding

# ============================================
# التكوين
# ============================================
GITHUB_TOKEN = "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"
REPO = "mutawakel-hub/UST-BOT"

# الـ Secrets المراد إضافتها
SECRETS = {
    "CLOUDFLARE_API_TOKEN": "cfut_rUSX7nGmRjGyoOX3SRybHg2YWkqB4RTMWTlarcsL3ffee7df",
    "CLOUDFLARE_ACCOUNT_ID": "821ba2812d9ca15396ea53dcb8ecd8d5",
}

# ============================================
# الحصول على المفتاح العام للمستودع
# ============================================
def get_public_key():
    url = f"https://api.github.com/repos/{REPO}/actions/secrets/public-key"
    req = urllib.request.Request(url, headers={
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

# ============================================
# تشفير الـ secret
# ============================================
def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    """تشفير الـ secret باستخدام NaCl (libsodium)"""
    public_key_bytes = public_key_b64.encode("utf-8")
    public_key = public.PublicKey(public_key_bytes, encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return b64encode(encrypted).decode("utf-8")

# ============================================
# إضافة الـ secret للمستودع
# ============================================
def put_secret(key_id: str, public_key_b64: str, secret_name: str, secret_value: str):
    encrypted_value = encrypt_secret(public_key_b64, secret_value)
    url = f"https://api.github.com/repos/{REPO}/actions/secrets/{secret_name}"
    data = json.dumps({
        "encrypted_value": encrypted_value,
        "key_id": key_id,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PUT", headers={
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status == 204 or resp.status == 201
    except urllib.error.HTTPError as e:
        print(f"   ❌ HTTP Error: {e.code}")
        print(f"   Response: {e.read().decode()}")
        return False

# ============================================
# التنفيذ
# ============================================
print("🔐 إضافة GitHub Actions Secrets...")
print(f"📦 Repository: {REPO}")
print()

# الحصول على المفتاح العام
print("🔑 الحصول على المفتاح العام للمستودع...")
pub_key = get_public_key()
print(f"   ✅ key_id: {pub_key['key_id']}")
print()

# إضافة كل الـ secrets
for name, value in SECRETS.items():
    print(f"🔐 إضافة {name}...")
    success = put_secret(pub_key["key_id"], pub_key["key"], name, value)
    if success:
        print(f"   ✅ تم بنجاح")
    else:
        print(f"   ❌ فشل")
    print()

# التحقق
print("📊 التحقق من الـ Secrets المضافة...")
url = f"https://api.github.com/repos/{REPO}/actions/secrets"
req = urllib.request.Request(url, headers={
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
print(f"   إجمالي الـ Secrets: {data.get('total_count', 0)}")
for s in data.get("secrets", []):
    print(f"   • {s['name']} (آخر تحديث: {s['updated_at']})")
