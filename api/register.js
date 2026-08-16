import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

export default async function handler(req, res) {

  // السماح بـ POST فقط
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    // التأكد من وجود إعدادات Supabase
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    // قراءة البيانات القادمة من الموقع
    const { username, password } = req.body || {};

    // التحقق من البيانات
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "أدخل اسم المستخدم وكلمة المرور"
      });
    }

    const cleanUsername = String(username).trim();

    // التحقق من اسم المستخدم
    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"
      });
    }

    // التحقق من كلمة المرور
    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      });
    }

    // Headers الخاصة بـ Supabase
    const headers = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    // =====================================================
    // البحث عن اسم المستخدم
    // =====================================================

    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username`,
      {
        method: "GET",
        headers
      }
    );

    if (!checkResponse.ok) {

      const errorText =
        await checkResponse.text();

      console.error(
        "Supabase check error:",
        errorText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر الاتصال بقاعدة البيانات"
      });
    }

    const existingUsers =
      await checkResponse.json();

    // إذا كان الاسم موجودًا
    if (
      Array.isArray(existingUsers) &&
      existingUsers.length > 0
    ) {

      return res.status(409).json({
        success: false,
        message: "اسم المستخدم مستخدم بالفعل"
      });

    }

    // =====================================================
    // تشفير كلمة المرور
    // =====================================================

    const passwordHash =
      hashPassword(password);

    // =====================================================
    // إنشاء الحساب في Supabase
    // =====================================================

    const insertResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/users`,
        {
          method: "POST",

          headers: {
            ...headers,

            "Prefer":
              "return=representation"
          },

          body: JSON.stringify({

            username:
              cleanUsername,

            password_hash:
              passwordHash,

            balance:
              9999

          })
        }
      );

    const insertText =
      await insertResponse.text();

    // التحقق من نجاح الإضافة
    if (!insertResponse.ok) {

      console.error(
        "Supabase insert error:",
        insertText
      );

      return res.status(500).json({
        success: false,
        message: "فشل حفظ الحساب في قاعدة البيانات"
      });

    }

    let insertedUsers;

    try {

      insertedUsers =
        JSON.parse(insertText);

    } catch {

      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });

    }

    if (
      !Array.isArray(insertedUsers) ||
      insertedUsers.length === 0
    ) {

      return res.status(500).json({
        success: false,
        message: "لم يتم إنشاء الحساب"
      });

    }

    const user =
      insertedUsers[0];

    // =====================================================
    // إرسال بيانات المستخدم للموقع
    // =====================================================

    return res.status(201).json({

      success: true,

      message:
        "تم إنشاء الحساب بنجاح 🎉",

      user: {

        id:
          user.id,

        username:
          user.username,

        balance:
          Number(
            user.balance || 9999
          )

      }

    });

  } catch (error) {

    console.error(
      "Register error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "حدث خطأ في الخادم"

    });

  }

}
