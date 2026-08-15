
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
    const key = cleanUsername.toLowerCase();

    const user = users.get(key);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة السر غير صحيحة"
      });
    }

    const passwordHash = hashPassword(String(password));

    if (user.password !== passwordHash) {
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة السر غير صحيحة"
      });
    }

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
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
