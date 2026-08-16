
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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

    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "معرف المستخدم مفقود"
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=id,username,balance`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {

      console.error(
        "Supabase balance error:",
        text
      );

      return res.status(500).json({
        success: false,
        message: "تعذر قراءة الرصيد من قاعدة البيانات"
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

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      }
    });

  } catch (error) {

    console.error(
      "Balance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
