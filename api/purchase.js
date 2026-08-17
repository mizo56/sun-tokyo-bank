
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

    const { username, item, price } = req.body || {};

    if (!username || !item || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "بيانات الشراء ناقصة"
      });
    }

    const cleanUsername = String(username).trim();
    const amount = Number(price);

    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم غير صحيح"
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "سعر المنتج غير صحيح"
      });
    }

    // جلب المستخدم
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username,balance`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("Supabase user error:", userText);

      return res.status(500).json({
        success: false,
        message: "تعذر الاتصال بقاعدة البيانات"
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

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    const currentBalance = Number(user.balance || 0);

    // التأكد من وجود رصيد كافٍ
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "❌ رصيدك غير كافٍ",
        balance: currentBalance
      });
    }

    const newBalance = currentBalance - amount;

    // خصم المبلغ من الحساب
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText = await updateResponse.text();

    if (!updateResponse.ok) {
      console.error("Supabase balance update error:", updateText);

      return res.status(500).json({
        success: false,
        message: "تعذر خصم المبلغ من الرصيد"
      });
    }

    let updatedUsers;

    try {
      updatedUsers = JSON.parse(updateText);
    } catch {
      updatedUsers = [];
    }

    const updatedUser =
      Array.isArray(updatedUsers) && updatedUsers.length
        ? updatedUsers[0]
        : null;

    return res.status(200).json({
      success: true,
      message: `✅ تم شراء ${item} بنجاح`,
      purchase: {
        item: String(item),
        price: amount
      },
      user: {
        id: user.id,
        username: user.username,
        balance: updatedUser
          ? Number(updatedUser.balance || 0)
          : newBalance
      }
    });

  } catch (error) {
    console.error("Purchase error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في الخادم"
    });
  }
}
