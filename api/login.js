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
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    let body = req.body || {};

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
      body.username || body.name || ""
    ).trim();

    const password = String(
      body.password || body.pass || ""
    );

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });
    }

    const passwordHash = hashPassword(password);

    const headers = {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    const url =
      `${SUPABASE_URL}/rest/v1/users` +
      `?username=eq.${encodeURIComponent(username)}` +
      `&select=id,username,password_hash,balance,role,level,city`;

    console.log("Login attempt:", username);

    const response = await fetch(url, {
      method: "GET",
      headers
    });

    const text = await response.text();

    /*
      إذا فشل الاتصال بـ Supabase،
      نعرض رقم HTTP للمستخدم لمعرفة المشكلة.
    */
    if (!response.ok) {
      console.error(
        "Supabase login error:",
        response.status,
        text
      );

      return res.status(500).json({
        success: false,
        message: `خطأ Supabase: HTTP ${response.status}`
      });
    }

    let users;

    try {
      users = JSON.parse(text);
    } catch {
      console.error(
        "Invalid Supabase response:",
        text
      );

      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const user = users[0];

    if (
      !user.password_hash ||
      user.password_hash !== passwordHash
    ) {
      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const role = String(
      user.role || "user"
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "owner";

    const balance = isAdmin
      ? Number.MAX_SAFE_INTEGER
      : Number(user.balance || 0);

    const userData = {
      id: user.id,
      username: user.username,
      balance,
      role: isAdmin ? "admin" : "user",
      isAdmin,

      level: Number(user.level || 1),

      city: Number(user.city || 1)
    };

    console.log(
      "Login successful:",
      {
        username: user.username,
        role: userData.role,
        isAdmin: userData.isAdmin
      }
    );

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
      message: "حدث خطأ في الخادم"
    });
  }
}
