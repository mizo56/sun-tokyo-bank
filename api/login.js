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
  // السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {
    // التحقق من إعدادات Supabase
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      console.error("Missing Supabase environment variables");

      return res.status(500).json({
        success: false,
        message: "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    // قراءة البيانات
    let body = req.body || {};

    // في حال وصلت البيانات كنص JSON
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
      body.username ||
      body.name ||
      ""
    ).trim();

    const password = String(
      body.password ||
      body.pass ||
      ""
    );

    // التحقق من البيانات
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });
    }

    // تشفير كلمة المرور
    const passwordHash = hashPassword(password);

    // تجهيز رابط Supabase
    const url =
      `${SUPABASE_URL}/rest/v1/users` +
      `?username=eq.${encodeURIComponent(username)}` +
      `&password_hash=eq.${encodeURIComponent(passwordHash)}` +
      `&select=id,username,balance`;

    console.log("Login request:", {
      username,
      hasPassword: !!password
    });

    // البحث في قاعدة البيانات
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "Supabase login error:",
        response.status,
        text
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ في الاتصال بقاعدة البيانات"
      });
    }

    let users;

    try {
      users = JSON.parse(text);
    } catch {
      console.error("Invalid Supabase response:", text);

      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });
    }

    // الحساب غير موجود
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const user = users[0];

    // إرسال بيانات المستخدم
    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",

      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
