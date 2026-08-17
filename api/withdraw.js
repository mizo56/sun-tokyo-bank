
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const supabaseHeaders = () => ({
  "apikey": SUPABASE_SECRET_KEY,
  "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

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

    const {
      id,
      amount
    } = req.body || {};

    const withdrawAmount = Number(amount);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "معرف المستخدم مفقود"
      });
    }

    if (
      !Number.isFinite(withdrawAmount) ||
      withdrawAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "مبلغ السحب غير صحيح"
      });
    }

    // قراءة المستخدم
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=id,username,balance`,
      {
        method: "GET",
        headers: supabaseHeaders()
      }
    );

    const userText = await userResponse.text();

    if (!userResponse.ok) {

      console.error(
        "Withdraw user error:",
        userText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر قراءة الحساب"
      });
    }

    let users;

    try {
      users = JSON.parse(userText);
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
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    const oldBalance =
      Number(user.balance || 0);

    // التحقق من الرصيد
    if (oldBalance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: "❌ الرصيد غير كافٍ"
      });
    }

    const newBalance =
      oldBalance - withdrawAmount;

    // تحديث الرصيد
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: supabaseHeaders(),
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText =
      await updateResponse.text();

    if (!updateResponse.ok) {

      console.error(
        "Withdraw update error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر تحديث الرصيد"
      });
    }

    return res.status(200).json({
      success: true,
      message: "تم السحب بنجاح 💳",
      user: {
        id: user.id,
        username: user.username,
        balance: newBalance
      }
    });

  } catch (error) {

    console.error(
      "Withdraw error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
