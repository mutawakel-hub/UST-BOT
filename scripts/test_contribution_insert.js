// اختبار: محاولة إدراج إحسان مباشرة في Supabase
// استخدم: node scripts/test_contribution_insert.js

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gksivmyyfobnocjpnplf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY not set");
  process.exit(1);
}

async function test() {
  // 1. تأكد من وجود المستخدم في admin_users
  const testTelegramId = 8796334849; // المستخدم الحالي

  console.log("1. Checking admin_users...");
  const checkResp = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_users?telegram_id=eq.${testTelegramId}&select=telegram_id,first_name`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  const checkData = await checkResp.json();
  console.log("   admin_users:", JSON.stringify(checkData));

  // 2. محاولة إدراج إحسان
  console.log("\n2. Testing contribution insert...");
  const insertResp = await fetch(
    `${SUPABASE_URL}/rest/v1/contributions`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_telegram_id: testTelegramId,
        subject_id: 101,
        content_type_id: "summary",
        file_name: "test_file.pdf",
        file_size_mb: 1.5,
        telegram_file_id: "test_file_id_123",
        title: "ملخص تجريبي",
        description: "اختبار",
        status: "pending",
      }),
    }
  );

  console.log("   Status:", insertResp.status);
  const insertText = await insertResp.text();
  console.log("   Response:", insertText.substring(0, 500));

  if (insertResp.ok) {
    const inserted = JSON.parse(insertText);
    console.log("   ✅ Inserted with ID:", inserted[0]?.id);

    // 3. تحقق من ظهوره في pending
    console.log("\n3. Checking pending list...");
    const pendingResp = await fetch(
      `${SUPABASE_URL}/rest/v1/contributions?status=eq.pending&select=id,file_name,title,status&order=created_at.desc&limit=5`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const pendingData = await pendingResp.json();
    console.log("   Pending:", JSON.stringify(pendingData, null, 2));

    // 4. احذف الإحسان التجريبي
    if (inserted[0]?.id) {
      console.log("\n4. Deleting test contribution...");
      const delResp = await fetch(
        `${SUPABASE_URL}/rest/v1/contributions?id=eq.${inserted[0].id}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      console.log("   Delete status:", delResp.status);
    }
  } else {
    console.log("   ❌ Insert FAILED");
  }
}

test().catch(console.error);
