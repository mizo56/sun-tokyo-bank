
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

async function supabaseFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {})
    }
  });
}

function gameResult(game) {
  const random = Math.random();

  if (game === "dice") {
    const dice = Math.floor(Math.random() * 6) + 1;

    let reward = 0;

    if (dice === 6) reward = 150;
    else if (dice >= 4) reward = 50;

    return {
      name: "🎲 النرد",
      value: dice,
      reward
    };
  }

  if (game === "box") {
    const rewards = [0, 25, 50, 100, 200, 500];
    const reward =
      rewards[Math.floor(Math.random() * rewards.length)];

    return {
      name: "📦 الصندوق",
      value: reward,
      reward
    };
  }

  if (game === "wheel") {
    const rewards = [0, 50, 100, 250, 500, 1000];

    const reward =
      rewards[Math.floor(Math.random() * rewards.length)];

    return {
      name: "🎡 عجلة الحظ",
      value: reward,
      reward
    };
  }

  if (game === "daily") {
    return {
      name: "🎁 المكافأة اليومية",
      value: 500,
      reward: 500
    };
  }

  return null;
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

    const {
      username,
      password,
      game
    } = req.body || {};

    if (!username || !password || !game) {
      return res.status(400).json({
        success: false,
        message: "بيانات اللعبة غير مكتملة"
      });
    }

    const cleanUsername = String(username).trim();
    const passwordHash = hashPassword(String(password));

    const userResponse = await supabaseFetch(
      `/rest/v1/users?username=eq.${encodeURIComponent(
        cleanUsername
      )}&password_hash=eq.${encodeURIComponent(
        passwordHash
      )}&select=id,username,balance`
    );

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error(
        "Supabase game user error:",
        userText
      );

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
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const user = users[0];

    const costs = {
      dice: 25,
      box: 50,
      wheel: 100
    };

    const cost = costs[game] || 0;

    const currentBalance = Number(user.balance || 0);

    if (game === "daily") {
      return res.status(200).json({
        success: true,
        message: "🎁 تم استلام المكافأة اليومية",
        reward: 500,
        balance: currentBalance + 500
      });
    }

    if (!["dice", "box", "wheel"].includes(game)) {
      return res.status(400).json({
        success: false,
        message: "اللعبة غير موجودة"
      });
    }

    if (currentBalance < cost) {
      return res.status(400).json({
        success: false,
        message:
          `❌ رصيدك غير كافٍ. تحتاج ${cost} 💰`
      });
    }

    const result = gameResult(game);

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "تعذر تشغيل اللعبة"
      });
    }

    const newBalance =
      currentBalance -
      cost +
      Number(result.reward || 0);

    const updateResponse = await supabaseFetch(
      `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText =
      await updateResponse.text();

    if (!updateResponse.ok) {
      console.error(
        "Supabase balance update error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        message: "تعذر تحديث الرصيد"
      });
    }

    return res.status(200).json({
      success: true,

      message:
        result.reward > 0
          ? `🎉 ربحت ${result.reward} 💰`
          : "😢 لم تربح هذه المرة",

      game,

      gameName: result.name,

      value: result.value,

      cost,

      reward: result.reward,

      balance: newBalance
    });

  } catch (error) {
    console.error(
      "Game error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
