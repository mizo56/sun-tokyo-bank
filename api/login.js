import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password), "utf8")
    .digest("hex");
}

function createAdminSession(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  const signature = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function setAdminCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
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
        message: "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    if (!ADMIN_SESSION_SECRET) {
      return res.status(500).json({
        success: false,
        message: "ADMIN_SESSION_SECRET غير موجود في Vercel"
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

    const supabaseBase =
      SUPABASE_URL.replace(/\/+$/, "");

    const url =
      `${supabaseBase}/rest/v1/users` +
      `?username=eq.${encodeURIComponent(username)}` +
      `&select=id,username,password_hash,balance,role,banned,ban_reason`;

    console.log("Login attempt:", username);

    const response = await fetch(url, {
      method: "GET",
      headers
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
        message: `❌ خطأ Supabase: HTTP ${response.status}`
      });
    }

    let users;

    try {
      users = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });
    }

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

    /*
    ========================================
    التحقق من كلمة المرور
    ========================================
    */

    if (
      !user.password_hash ||
      user.password_hash !== passwordHash
    ) {
      return res.status(401).json({
        success: false,
        message: "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    /*
    ========================================
    التحقق من الحظر
    ========================================
    */

    if (user.banned === true) {

      return res.status(403).json({
        success: false,
        banned: true,
        message: "🚫 هذا الحساب محظور",
        reason:
          user.ban_reason ||
          "تم حظر الحساب من الإدارة"
      });

    }

    /*
    ========================================
    الدور
    ========================================
    */

    const role = String(
      user.role || "user"
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "owner";

    /*
    ========================================
    الرصيد
    ========================================
    */

    let balance = Number(
      user.balance || 0
    );

    if (!Number.isFinite(balance)) {
      balance = 0;
    }

    if (isAdmin) {
      balance = Number.MAX_SAFE_INTEGER;
    }

    /*
    ========================================
    بيانات المستخدم
    ========================================
    */

    const userData = {
      id: user.id,
      username: user.username,
      balance,
      role: isAdmin ? "admin" : "user",
      isAdmin,
      level: 1,
      city: 1
    };

    /*
    ========================================
    إنشاء جلسة الأدمن
    ========================================
    */

    if (isAdmin) {

      const session =
        createAdminSession(user);

      setAdminCookie(res, session);

      console.log(
        "Admin session created:",
        user.username
      );

    }

    console.log(
      "Login successful:",
      {
        id: user.id,
        username: user.username,
        role: userData.role,
        isAdmin
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
      message: "حدث خطأ في الخادم",
      details: error.message
    });

  }

}
