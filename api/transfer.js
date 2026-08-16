
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const headers = () => ({
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
      fromId,
      toUsername,
      amount
    } = req.body || {};

    const transferAmount = Number(amount);

    if (!fromId || !toUsername) {
      return res.status(400).json({
        success: false,
        message: "بيانات التحويل ناقصة"
      });
    }

    if (
      !Number.isFinite(transferAmount) ||
      transferAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "المبلغ غير صحيح"
      });
    }

    const cleanUsername = String(toUsername).trim();

    // البحث عن المرسل
    const senderResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(fromId)}&select=id,username,balance`,
      {
        method: "GET",
        headers: headers()
      }
    );

    const senderText = await senderResponse.text();

    if (!senderResponse.ok) {
      console.error("Sender error:", senderText);

      return res.status(500).json({
        success: false,
        message: "تعذر قراءة حساب المرسل"
      });
    }

    const senders = JSON.parse(senderText);

    if (!Array.isArray(senders) || senders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "حساب المرسل غير موجود"
      });
    }

    const sender = senders[0];
    const senderBalance = Number(sender.balance || 0);

    // لا يسمح بالتحويل إلى نفس الحساب
    if (
      String(sender.username).toLowerCase() ===
      cleanUsername.toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "لا يمكنك التحويل إلى نفسك"
      });
    }

    // التحقق من الرصيد
    if (senderBalance < transferAmount) {
      return res.status(400).json({
        success: false,
        message: "❌ الرصيد غير كافٍ"
      });
    }

    // البحث عن المستلم
    const receiverResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username,balance`,
      {
        method: "GET",
        headers: headers()
      }
    );

    const receiverText = await receiverResponse.text();

    if (!receiverResponse.ok) {
      console.error("Receiver error:", receiverText);

      return res.status(500).json({
        success: false,
        message: "تعذر البحث عن المستلم"
      });
    }

    const receivers = JSON.parse(receiverText);

    if (!Array.isArray(receivers) || receivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم المستلم غير موجود"
      });
    }

    const receiver = receivers[0];
    const receiverBalance = Number(receiver.balance || 0);

    // الرصيد الجديد
    const newSenderBalance =
      senderBalance - transferAmount;

    const newReceiverBalance =
      receiverBalance + transferAmount;

    // خصم المبلغ من المرسل
    const updateSender = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(fromId)}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          balance: newSenderBalance
        })
      }
    );

    const senderUpdateText =
      await updateSender.text();

    if (!updateSender.ok) {

      console.error(
        "Sender update error:",
        senderUpdateText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر خصم المبلغ من المرسل"
      });
    }

    // إضافة المبلغ للمستلم
    const updateReceiver = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(receiver.id)}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          balance: newReceiverBalance
        })
      }
    );

    const receiverUpdateText =
      await updateReceiver.text();

    if (!updateReceiver.ok) {

      console.error(
        "Receiver update error:",
        receiverUpdateText
      );

      // محاولة إعادة المبلغ للمرسل
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(fromId)}`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            balance: senderBalance
          })
        }
      );

      return res.status(500).json({
        success: false,
        message: "فشل التحويل وتم إرجاع المبلغ"
      });
    }

    return res.status(200).json({
      success: true,
      message: "تم التحويل بنجاح 💸",
      user: {
        id: sender.id,
        username: sender.username,
        balance: newSenderBalance
      },
      receiver: {
        id: receiver.id,
        username: receiver.username,
        balance: newReceiverBalance
      }
    });

  } catch (error) {

    console.error(
      "Transfer error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
