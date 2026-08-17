import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const ADMIN_USERNAME = "admin";

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function cleanUsername(value) {
  return String(value || "").trim();
}

async function supabase(path, options = {}) {

  const response = await fetch(
    `${SUPABASE_URL}${path}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = text;
  }

  if (!response.ok) {

    const error =
      new Error(
        data?.message ||
        data?.hint ||
        data?.details ||
        "خطأ في Supabase"
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {

      return res.status(500).json({
        success: false,
        message:
          "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    let body =
      req.body || {};

    if (typeof body === "string") {

      try {
        body =
          JSON.parse(body);
      } catch {

        return res.status(400).json({
          success: false,
          message:
            "بيانات الطلب غير صحيحة"
        });
      }
    }

    const username =
      cleanUsername(
        body.username ||
        body.name
      );

    const password =
      String(
        body.password ||
        body.pass ||
        ""
      );

    if (!username || !password) {

      return res.status(400).json({
        success: false,
        message:
          "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });
    }

    /*
     * البحث عن الحساب بالاسم فقط
     */

    const users =
      await supabase(
        `/rest/v1/users?username=eq.${encodeURIComponent(
          username
        )}&select=id,username,password_hash,balance`
      );

    if (
      !Array.isArray(users) ||
      users.length === 0
    ) {

      return res.status(401).json({
        success: false,
        message:
          "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const user =
      users[0];

    /*
     * إنشاء SHA-256 لكلمة المرور
     */

    const passwordHash =
      hashPassword(password);

    const storedHash =
      String(
        user.password_hash || ""
      ).trim();

    /*
     * مقارنة كلمة المرور
     */

    if (
      passwordHash !==
      storedHash
    ) {

      return res.status(401).json({
        success: false,
        message:
          "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    /*
     * تحديد الأدمن
     */

    const isAdmin =
      String(user.username)
        .trim()
        .toLowerCase() ===
      ADMIN_USERNAME;

    /*
     * إعادة بيانات المستخدم
     */

    return res.status(200).json({

      success: true,

      message:
        "✅ تم تسجيل الدخول بنجاح",

      user: {

        id:
          user.id,

        username:
          user.username,

        balance:
          Number(
            user.balance || 0
          ),

        isAdmin,

        unlimited:
          isAdmin

      }

    });

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "حدث خطأ في الخادم"

    });
  }
}
