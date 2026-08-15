
import crypto from "crypto";

const users = globalThis.__users || new Map();
globalThis.__users = users;

function createToken(username) {
  const data = `${username}:${Date.now()}`;
  return crypto
    .createHash("sha256")
    .update(data)
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
    const { username } = req.body || {};

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم مطلوب"
      });
    }

    const cleanUsername = String(username).trim();
    const key = cleanUsername.toLowerCase();

    const user = users.get(key);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "الحساب غير موجود"
      });
    }

    const token = createToken(user.username);

    return res.status(200).json({
      success: true,
      token,
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
