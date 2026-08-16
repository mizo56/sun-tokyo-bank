
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

    const {
      id,
      amount
    } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "معرف المستخدم مفقود"
      });
    }

    const change = Number(amount);

    if (!Number.isFinite(change)) {
      return res.status(400).json({
        success: false,
        message: "المبلغ غير صحيح"
      });
    }

    const headers = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // قراءة الرصيد الحالي
    const getResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=id,username,balance`,
      {
        method: "GET",
        headers
      }
    );

    const getText = await getResponse.text();

    if (!getResponse.ok) {

      console.error(
        "Supabase get balance error:",
        getText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر قراءة الرصيد"
      });
    }

    let users;

    try {
      users = JSON.parse(getText);
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

    const oldBalance = Number(user.balance || 0);
    const newBalance = oldBalance + change;

    // منع الرصيد من النزول تحت الصفر
    if (newBalance < 0) {
      return res.status(400).json({
        success: false,
        message: "❌ الرصيد غير كافٍ"
      });
    }

    // تحديث الرصيد
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText = await updateResponse.text();

    if (!updateResponse.ok) {

      console.error(
        "Supabase update balance error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر تحديث الرصيد"
      });
    }

    let updatedUsers;

    try {
      updatedUsers = JSON.parse(updateText);
    } catch {
      updatedUsers = [];
    }

    const updatedUser =
      Array.isArray(updatedUsers) &&
      updatedUsers.length > 0
        ? updatedUsers[0]
        : {
            id: user.id,
            username: user.username,
            balance: newBalance
          };

    return res.status(200).json({
      success: true,
      message: "تم تحديث الرصيد بنجاح",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        balance: Number(
          updatedUser.balance ?? newBalance
        )
      }
    });

  } catch (error) {

    console.error(
      "Update balance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
