
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function send(res, status, data) {
  return res.status(status).json(data);
}

function clean(value) {
  return String(value || "").trim();
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}${path}`,
    {
      ...options,
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.hint ||
      "خطأ في قاعدة البيانات"
    );
  }

  return data;
}

function checkAdmin(username, password) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    return false;
  }

  return (
    clean(username) === ADMIN_USERNAME &&
    hashPassword(password) === ADMIN_PASSWORD_HASH
  );
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return send(res, 405, {
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return send(res, 500, {
        success: false,
        message: "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    const body = req.body || {};

    const action = clean(body.action);
    const username = clean(body.username);
    const password = String(body.password || "");

    /*
    =====================================================
    تسجيل دخول الأدمن
    =====================================================
    */

    if (action === "login") {

      if (!username || !password) {
        return send(res, 400, {
          success: false,
          message: "اسم المستخدم وكلمة المرور مطلوبان"
        });
      }

      if (!checkAdmin(username, password)) {
        return send(res, 401, {
          success: false,
          message: "بيانات الأدمن غير صحيحة"
        });
      }

      return send(res, 200, {
        success: true,
        admin: {
          username: ADMIN_USERNAME,
          role: "admin"
        }
      });
    }

    /*
    =====================================================
    التحقق من صلاحية الأدمن
    =====================================================
    */

    if (!checkAdmin(username, password)) {
      return send(res, 401, {
        success: false,
        message: "غير مصرح. يجب تسجيل دخول الأدمن."
      });
    }

    /*
    =====================================================
    جلب جميع الأعضاء
    =====================================================
    */

    if (action === "users") {

      const users = await supabaseRequest(
        "/rest/v1/users?select=id,username,phone,balance,created_at&order=id.desc",
        {
          method: "GET"
        }
      );

      return send(res, 200, {
        success: true,
        users: Array.isArray(users) ? users : []
      });
    }

    /*
    =====================================================
    معلومات عضو واحد
    =====================================================
    */

    if (action === "user") {

      const userId = clean(body.userId);

      if (!userId) {
        return send(res, 400, {
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      const users = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,phone,balance,created_at`,
        {
          method: "GET"
        }
      );

      if (!users.length) {
        return send(res, 404, {
          success: false,
          message: "العضو غير موجود"
        });
      }

      return send(res, 200, {
        success: true,
        user: users[0]
      });
    }

    /*
    =====================================================
    تغيير رصيد عضو
    =====================================================
    */

    if (action === "set_balance") {

      const userId = clean(body.userId);
      const balance = Number(body.balance);

      if (!userId) {
        return send(res, 400, {
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (!Number.isFinite(balance) || balance < 0) {
        return send(res, 400, {
          success: false,
          message: "الرصيد غير صحيح"
        });
      }

      const users = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET"
        }
      );

      if (!users.length) {
        return send(res, 404, {
          success: false,
          message: "العضو غير موجود"
        });
      }

      const updated = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            balance
          })
        }
      );

      return send(res, 200, {
        success: true,
        message: "تم تحديث الرصيد",
        user: updated[0]
      });
    }

    /*
    =====================================================
    إضافة رصيد
    =====================================================
    */

    if (action === "add_balance") {

      const userId = clean(body.userId);
      const amount = Number(body.amount);

      if (!userId) {
        return send(res, 400, {
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return send(res, 400, {
          success: false,
          message: "المبلغ غير صحيح"
        });
      }

      const users = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET"
        }
      );

      if (!users.length) {
        return send(res, 404, {
          success: false,
          message: "العضو غير موجود"
        });
      }

      const oldBalance = Number(users[0].balance || 0);
      const newBalance = oldBalance + amount;

      const updated = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            balance: newBalance
          })
        }
      );

      return send(res, 200, {
        success: true,
        message: `تم إضافة ${amount} إلى رصيد العضو`,
        user: updated[0]
      });
    }

    /*
    =====================================================
    خصم رصيد
    =====================================================
    */

    if (action === "remove_balance") {

      const userId = clean(body.userId);
      const amount = Number(body.amount);

      if (!userId) {
        return send(res, 400, {
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return send(res, 400, {
          success: false,
          message: "المبلغ غير صحيح"
        });
      }

      const users = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET"
        }
      );

      if (!users.length) {
        return send(res, 404, {
          success: false,
          message: "العضو غير موجود"
        });
      }

      const oldBalance = Number(users[0].balance || 0);

      if (oldBalance < amount) {
        return send(res, 400, {
          success: false,
          message: "رصيد العضو أقل من المبلغ المطلوب خصمه"
        });
      }

      const newBalance = oldBalance - amount;

      const updated = await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            balance: newBalance
          })
        }
      );

      return send(res, 200, {
        success: true,
        message: `تم خصم ${amount} من رصيد العضو`,
        user: updated[0]
      });
    }

    /*
    =====================================================
    حذف عضو
    =====================================================
    */

    if (action === "delete_user") {

      const userId = clean(body.userId);

      if (!userId) {
        return send(res, 400, {
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      await supabaseRequest(
        `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "DELETE"
        }
      );

      return send(res, 200, {
        success: true,
        message: "تم حذف العضو"
      });
    }

    /*
    =====================================================
    إحصائيات البنك
    =====================================================
    */

    if (action === "stats") {

      const users = await supabaseRequest(
        "/rest/v1/users?select=id,username,balance",
        {
          method: "GET"
        }
      );

      const list = Array.isArray(users) ? users : [];

      const totalBalance = list.reduce(
        (total, user) =>
          total + Number(user.balance || 0),
        0
      );

      return send(res, 200, {
        success: true,
        stats: {
          users: list.length,
          totalBalance
        }
      });
    }

    /*
    =====================================================
    العملية غير معروفة
    =====================================================
    */

    return send(res, 400, {
      success: false,
      message: "أمر غير معروف"
    });

  } catch (error) {

    console.error(
      "ADMIN API ERROR:",
      error
    );

    return send(res, 500, {
      success: false,
      message: error.message || "حدث خطأ في الخادم"
    });
  }
}
