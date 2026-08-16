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

    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "أدخل اسم المستخدم وكلمة المرور"
      });
    }

    const cleanUsername = String(username).trim();

    const passwordHash = hashPassword(password);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&password_hash=eq.${encodeURIComponent(passwordHash)}&select=id,username,balance`,
      {
        method: "GET",

        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const responseText = await response.text();

    if (!response.ok) {

      console.error(
        "Supabase login error:",
        responseText
      );

      return res.status(500).json({
        success: false,
        message: "حدث خطأ في الاتصال بقاعدة البيانات"
      });
    }

    let users;

    try {
      users = JSON.parse(responseText);
    } catch {

      return res.status(500).json({
        success: false,
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });

    }

    if (!Array.isArray(users) || users.length === 0) {

      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });

    }

    const user = users[0];

    return res.status(200).json({

      success: true,

      message: "تم تسجيل الدخول بنجاح",

      user: {

        id: user.id,

        username: user.username,

        balance: Number(
          user.balance || 0
        )

      }

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
