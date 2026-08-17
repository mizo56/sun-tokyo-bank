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

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));

  if (A.length !== B.length) {
    return false;
  }

  return crypto.timingSafeEqual(A, B);
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

    error.data =
      data;

    throw error;
  }

  return data;
}

export default async function handler(req, res) {

  /*
   * POST فقط
   */

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    /*
     * التأكد من وجود إعدادات Supabase
     */

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {

      console.error(
        "Missing Supabase environment variables"
      );

      return res.status(500).json({
        success: false,
        message:
          "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    /*
     * قراءة البيانات
     */

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

    /*
     * اسم المستخدم
     */

    const username =
      cleanUsername(
        body.username ||
        body.name
      );

    /*
     * كلمة المرور
     */

    const password =
      String(
        body.password ||
        body.pass ||
        ""
      );

    /*
     * التحقق من البيانات
     */

    if (!username || !password) {

      return res.status(400).json({
        success: false,
        message:
          "❌ اسم المستخدم وكلمة المرور مطلوبان"
      });
    }

    /*
     * البحث عن المستخدم بالاسم فقط.
     *
     * لا نضع password_hash داخل رابط Supabase.
     * نقرأ المستخدم أولًا ثم نقارن كلمة المرور
     * داخل الخادم.
     */

    const users =
      await supabase(
        `/rest/v1/users?username=eq.${encodeURIComponent(
          username
        )}&select=id,username,password_hash,balance`
      );

    /*
     * المستخدم غير موجود
     */

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
     * التأكد من وجود password_hash
     */

    if (!user.password_hash) {

      console.error(
        "User has no password_hash:",
        user.username
      );

      return res.status(401).json({
        success: false,
        message:
          "❌ الحساب غير مكتمل إعداد كلمة المرور"
      });
    }

    /*
     * تشفير كلمة المرور التي أدخلها المستخدم
     */

    const passwordHash =
      hashPassword(password);

    /*
     * كلمة المرور المخزنة في Supabase
     */

    const storedHash =
      String(
        user.password_hash
      );

    /*
     * مقارنة آمنة
     */

    const passwordCorrect =
      safeEqual(
        passwordHash,
        storedHash
      );

    /*
     * كلمة المرور خاطئة
     */

    if (!passwordCorrect) {

      return res.status(401).json({
        success: false,
        message:
          "❌ اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    /*
     * تحديد حساب الأدمن
     *
     * اسم الحساب يجب أن يكون:
     *
     * admin
     *
     * بدون الاهتمام بحالة الأحرف.
     */

    const isAdmin =
      String(user.username)
        .trim()
        .toLowerCase() ===
      ADMIN_USERNAME;

    /*
     * الرصيد الحقيقي من قاعدة البيانات.
     *
     * لا نضع Infinity هنا لأن JSON لا يدعم
     * Infinity بشكل صحيح.
     *
     * الواجهة تستخدم unlimited لمعرفة أن
     * الحساب أدمن.
     */

    const balance =
      Number(
        user.balance || 0
      );

    /*
     * نجاح تسجيل الدخول
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

        balance,

        /*
         * هل الحساب أدمن؟
         */

        isAdmin,

        /*
         * هل الحساب غير محدود؟
         */

        unlimited:
          isAdmin
      }
    });

  } catch (error) {

    console.error(
      "LOGIN API ERROR:",
      error
    );

    return res.status(
      error?.status >= 400 &&
      error?.status < 500
        ? error.status
        : 500
    ).json({

      success: false,

      message:
        error?.message ||
        "حدث خطأ في الخادم"
    });
  }
}
