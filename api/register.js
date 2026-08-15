
import crypto from "crypto";

const users = globalThis.__users || new Map();
globalThis.__users = users;

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
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "أدخل اسم المستخدم وكلمة السر"
      });
    }

    const cleanUsername = String(username).trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة السر يجب أن تكون 6 أحرف على الأقل"
      });
    }

    const key = cleanUsername.toLowerCase();

    if (users.has(key)) {
      return res.status(409).json({
        success: false,
        message: "اسم المستخدم مستخدم بالفعل"
      });
    }

    const user = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      password: hashPassword(password),
      balance: 9999,
      xp: 0,
      level: 1,
      avatar: "🧙",
      city: 1,
      farm: 1,
      crops: 0,
      loan: 0,
      loan_due: 0,
      stocks1: 0,
      stocks2: 0,
      items: {},
      buildings: [],
      createdAt: new Date().toISOString()
    };

    users.set(key, user);

    return res.status(201).json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        xp: user.xp,
        level: user.level,
        avatar: user.avatar,
        city: user.city,
        farm: user.farm,
        crops: user.crops,
        loan: user.loan,
        loan_due: user.loan_due,
        stocks1: user.stocks1,
        stocks2: user.stocks2,
        items: user.items,
        buildings: user.buildings
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
}
