import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

export default async function handler(req, res) {
  // POST فقط
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {
    // التحقق من متغيرات Vercel
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "❌ إعدادات Supabase غير موجودة في Vercel"
      });
    }

    // قراءة Body
    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          message: "❌ بيانات الطلب غير صحيحة"
        });
      }
    }

    const username = String(
      body.username ||
      body.name ||
      ""
    ).trim();

    const password = String(
      body.password ||
      body.pass ||
      ""
    );

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });
    }

    // تشفير كلمة المرور
    const passwordHash = hashPassword(password);

    // تنظيف الرابط
    const baseUrl = SUPABASE_URL.replace(/\/+$/, "");

    /*
      نستخدم encodeURIComponent للاسم
      حتى لا يسبب رموز خاصة مشكلة في رابط Supabase
    */
    const usernameEncoded = encodeURIComponent(username);

    const url =
      `${baseUrl}/rest/v1/users` +
      `?username=eq.${usernameEncoded}` +
      `&select=id,username,password_hash,balance,role,level,city` +
      `&limit=1`;

    console.log("Login request:", username);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        Accept: "application/json"
      }
    });

    const text = await response.text();

    console.log(
      "Supabase response:",
      response.status,
      text
    );

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `❌ خطأ Supabase: HTTP ${response.status}`,
        details: text
      });
    }

    let users;

    try {
      users = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        message: "❌ استجابة غير صحيحة من Supabase"
      });
    }

    // الحساب غير موجود
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const user = users[0];

    // التحقق من كلمة المرور
    if (
      !user.password_hash ||
      user.password_hash !== passwordHash
    ) {
      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    // الدور
    const role = String(
      user.role || "user"
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "owner";

    /*
      حساب الإدارة:
      لا نخزن Infinity داخل Supabase.
      نرسل رقمًا كبيرًا للواجهة.
    */
    const balance = isAdmin
      ? Number.MAX_SAFE_INTEGER
      : Number(user.balance || 0);

    const userData = {
      id: user.id,
      username: user.username,
      balance: balance,
      role: isAdmin ? "admin" : "user",
      isAdmin: isAdmin,
      level: Number(user.level || 1),
      city: Number(user.city || 1)
    };

    console.log(
      "Login successful:",
      userData.username,
      userData.role
    );

    return res.status(200).json({
      success: true,
      message: isAdmin
        ? "👑 تم دخول حساب الإدارة بنجاح"
        : "✅ تم تسجيل الدخول بنجاح",
      user: userData
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في الخادم",
      details: error.message
    });
  }
}
