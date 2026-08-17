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
        message: "إعدادات Supabase غير موجودة"
      });
    }

    const {
      fromUsername,
      toUsername,
      amount
    } = req.body || {};

    const from = String(fromUsername || "").trim();
    const to = String(toUsername || "").trim();
    const money = Number(amount);

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "اسم المرسل والمستلم مطلوبان"
      });
    }

    if (from === to) {
      return res.status(400).json({
        success: false,
        message: "لا يمكنك التحويل إلى نفسك"
      });
    }

    if (!Number.isFinite(money) || money <= 0) {
      return res.status(400).json({
        success: false,
        message: "مبلغ التحويل غير صحيح"
      });
    }

    // جلب المرسل
    const senderResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(from)}&select=id,username,balance`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    const senderUsers = await senderResponse.json();

    if (!senderResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى حساب المرسل"
      });
    }

    if (!Array.isArray(senderUsers) || senderUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "حساب المرسل غير موجود"
      });
    }

    const sender = senderUsers[0];
    const senderBalance = Number(sender.balance || 0);

    if (senderBalance < money) {
      return res.status(400).json({
        success: false,
        message: "❌ رصيدك غير كافٍ",
        balance: senderBalance
      });
    }

    // جلب المستلم
    const receiverResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(to)}&select=id,username,balance`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    const receiverUsers = await receiverResponse.json();

    if (!receiverResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى حساب المستلم"
      });
    }

    if (!Array.isArray(receiverUsers) || receiverUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستلم غير موجود"
      });
    }

    const receiver = receiverUsers[0];
    const receiverBalance = Number(receiver.balance || 0);

    const newSenderBalance = senderBalance - money;
    const newReceiverBalance = receiverBalance + money;

    // خصم من المرسل
    const senderUpdate = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(sender.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          balance: newSenderBalance
        })
      }
    );

    if (!senderUpdate.ok) {
      const errorText = await senderUpdate.text();

      console.error("Sender update error:", errorText);

      return res.status(500).json({
        success: false,
        message: "تعذر خصم المبلغ من المرسل"
      });
    }

    // إضافة للمستلم
    const receiverUpdate = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(receiver.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          balance: newReceiverBalance
        })
      }
    );

    if (!receiverUpdate.ok) {
      const errorText = await receiverUpdate.text();

      console.error("Receiver update error:", errorText);

      // محاولة إعادة المبلغ للمرسل
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(sender.id)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            balance: senderBalance
          })
        }
      );

      return res.status(500).json({
        success: false,
        message: "تعذر إضافة المبلغ للمستلم وتم إلغاء العملية"
      });
    }

    return res.status(200).json({
      success: true,
      message: `✅ تم تحويل ${money} إلى ${receiver.username} بنجاح`,
      transfer: {
        from: sender.username,
        to: receiver.username,
        amount: money
      },
      balances: {
        sender: newSenderBalance,
        receiver: newReceiverBalance
      }
    });

  } catch (error) {
    console.error("Transfer error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في الخادم"
    });
  }
}
