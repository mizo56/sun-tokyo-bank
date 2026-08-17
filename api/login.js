import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password), "utf8")
    .digest("hex");
}

export default async function handler(req, res) {

  // =========================
  // POST فقط
  // =========================

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    // =========================
    // التحقق من إعدادات Supabase
    // =========================

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {

      console.error("Missing Supabase environment variables");

      return res.status(500).json({
        success: false,
        message: "إعدادات Supabase غير موجودة في Vercel"
      });

    }

    // =========================
    // قراءة البيانات
    // =========================

    let body = req.body;

    if (!body) {
      body = {};
    }

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          message: "بيانات الطلب غير صحيحة"
        });
      }
    }

    const username = String(
      body.username || ""
    ).trim();

    const password = String(
      body.password || ""
    );

    // =========================
    // التحقق
    // =========================

    if (!username || !password) {

      return res.status(400).json({
        success: false,
        message: "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });

    }

    // =========================
    // تشفير كلمة المرور
    // =========================

    const passwordHash = hashPassword(password);

    // =========================
    // Headers
    // =========================

    const headers = {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    // =========================
    // رابط Supabase
    // =========================

    const supabaseBase =
      SUPABASE_URL.replace(/\/+$/, "");

    const url =
      `${supabaseBase}/rest/v1/users` +
      `?username=eq.${encodeURIComponent(username)}` +
      `&select=id,username,password_hash,balance,role`;

    console.log("Login attempt:", username);

    // =========================
    // طلب الحساب
    // =========================

    const response = await fetch(url, {
      method: "GET",
      headers
    });

    const text = await response.text();

    console.log(
      "Supabase response:",
      response.status,
      text
    );

    // =========================
    // فشل Supabase
    // =========================

    if (!response.ok) {

      console.error(
        "Supabase login error:",
        response.status,
        text
      );

      return res.status(500).json({
        success: false,
        message: `❌ خطأ Supabase: HTTP ${response.status}`,
        details: text
      });

    }

    // =========================
    // تحويل الرد إلى JSON
    // =========================

    let users;

    try {

      users = JSON.parse(text);

    } catch {

      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات",
        details: text
      });

    }

    // =========================
    // الحساب غير موجود
    // =========================

    if (
      !Array.isArray(users) ||
      users.length === 0
    ) {

      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });

    }

    const user = users[0];

    // =========================
    // التحقق من كلمة المرور
    // =========================

    if (
      !user.password_hash ||
      user.password_hash !== passwordHash
    ) {

      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });

    }

    // =========================
    // الدور
    // =========================

    const role = String(
      user.role || "user"
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "owner";

    // =========================
    // الرصيد
    // =========================

    let balance = Number(
      user.balance || 0
    );

    if (!Number.isFinite(balance)) {
      balance = 0;
    }

    /*
      حساب الإدارة يحصل على رقم كبير
      داخل الواجهة فقط.
      لا نضع Infinity في قاعدة البيانات.
    */

    if (isAdmin) {
      balance = Number.MAX_SAFE_INTEGER;
    }

    // =========================
    // بيانات المستخدم
    // =========================

    const userData = {

      id: user.id,

      username: user.username,

      balance,

      role: isAdmin
        ? "admin"
        : "user",

      isAdmin,

      level: 1,

      city: 1

    };

    console.log(
      "Login successful:",
      {
        id: user.id,
        username: user.username,
        role: userData.role,
        isAdmin: userData.isAdmin
      }
    );

    // =========================
    // الرد النهائي
    // =========================

    return res.status(200).json({

      success: true,

      message: isAdmin
        ? "👑 تم دخول حساب الإدارة بنجاح"
        : "✅ تم تسجيل الدخول بنجاح",

      user: userData

    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({

      success: false,

      message: "حدث خطأ في الخادم",

      details: error.message

    });

  }

}
