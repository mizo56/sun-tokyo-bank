import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password), "utf8")
    .digest("hex");
}

function getHeaders() {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json"
  };
}

function supabaseUrl(path) {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${path}`;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(supabaseUrl(path), {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.error(
      "Supabase Admin Error:",
      response.status,
      text
    );

    throw new Error(`Supabase HTTP ${response.status}`);
  }

  return data;
}

function normalizeBody(req) {
  let body = req.body || {};

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

/*
========================================
 إنشاء توقيع للجلسة
========================================
*/

function signSession(payload) {
  return crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("hex");
}

/*
========================================
 التحقق من جلسة الأدمن
========================================
*/

function verifySession(session) {
  try {
    if (!session || !ADMIN_SESSION_SECRET) {
      return false;
    }

    const parts = String(session).split(".");

    if (parts.length !== 2) {
      return false;
    }

    const payload = parts[0];
    const signature = parts[1];

    const expected = signSession(payload);

    if (signature.length !== expected.length) {
      return false;
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return false;
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (!decoded || !decoded.id) {
      return false;
    }

    if (
      !decoded.expires ||
      Date.now() > Number(decoded.expires)
    ) {
      return false;
    }

    return decoded;

  } catch (error) {
    console.error("Session verification error:", error);
    return false;
  }
}

/*
========================================
 التحقق من الأدمن
========================================
*/

async function verifyAdmin(body, req) {

  /*
    أولًا: محاولة استخدام جلسة الأدمن
  */

  const session =
    body.adminSession ||
    req.headers["x-admin-session"] ||
    "";

  if (session) {

    const sessionData =
      verifySession(session);

    if (sessionData) {

      const users =
        await supabaseRequest(
          `users?id=eq.${encodeURIComponent(sessionData.id)}` +
          `&select=id,username,role,banned`
        );

      if (
        Array.isArray(users) &&
        users.length > 0
      ) {

        const user = users[0];

        const role =
          String(
            user.role || "user"
          ).toLowerCase();

        const isAdmin =
          role === "admin" ||
          role === "administrator" ||
          role === "owner";

        if (
          isAdmin &&
          user.banned !== true
        ) {

          return {
            ok: true,
            id: user.id,
            username: user.username,
            session: true
          };

        }

      }

    }
  }

  /*
    دعم تسجيل دخول الأدمن القديم
    عند الحاجة
  */

  const username =
    String(
      body.adminUsername || ""
    ).trim();

  const password =
    String(
      body.adminPassword || ""
    );

  if (!username || !password) {
    return {
      ok: false,
      message: "جلسة الإدارة غير صالحة"
    };
  }

  const users =
    await supabaseRequest(
      `users?username=eq.${encodeURIComponent(username)}` +
      `&select=id,username,password_hash,role,banned`
    );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return {
      ok: false,
      message: "حساب الإدارة غير موجود"
    };
  }

  const user = users[0];

  if (user.banned === true) {
    return {
      ok: false,
      message: "حساب الإدارة محظور"
    };
  }

  const passwordHash =
    hashPassword(password);

  const role =
    String(
      user.role || "user"
    ).toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "owner";

  if (!isAdmin) {
    return {
      ok: false,
      message: "هذا الحساب ليس حساب إدارة"
    };
  }

  if (
    user.password_hash !== passwordHash
  ) {
    return {
      ok: false,
      message: "كلمة مرور الإدارة غير صحيحة"
    };
  }

  return {
    ok: true,
    id: user.id,
    username: user.username,
    session: false
  };
}

/*
========================================
 GET USERS
========================================
*/

async function getUsers(search = "") {

  let path =
    "users" +
    "?select=id,created_at,username,balance,role,banned,ban_reason,updated_at" +
    "&order=created_at.desc";

  if (search) {
    path +=
      `&username=ilike.*${encodeURIComponent(search)}*`;
  }

  return await supabaseRequest(path);
}

/*
========================================
 GET USER
========================================
*/

async function getUser(userId) {

  const users =
    await supabaseRequest(
      `users?id=eq.${encodeURIComponent(userId)}` +
      `&select=id,created_at,username,balance,role,banned,ban_reason,updated_at`
    );

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {
    return null;
  }

  return users[0];
}

/*
========================================
 UPDATE USER
========================================
*/

async function updateUser(userId, updates) {

  updates.updated_at =
    new Date().toISOString();

  return await supabaseRequest(
    `users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(updates)
    }
  );
}

/*
========================================
 STATISTICS
========================================
*/

async function statistics() {

  const users =
    await supabaseRequest(
      "users?select=id,balance,role,banned"
    );

  const list =
    Array.isArray(users)
      ? users
      : [];

  let totalBalance = 0;
  let admins = 0;
  let normalUsers = 0;
  let bannedUsers = 0;

  for (const user of list) {

    totalBalance +=
      Number(user.balance || 0);

    const role =
      String(
        user.role || "user"
      ).toLowerCase();

    if (
      role === "admin" ||
      role === "administrator" ||
      role === "owner"
    ) {
      admins++;
    } else {
      normalUsers++;
    }

    if (user.banned === true) {
      bannedUsers++;
    }
  }

  return {
    users: list.length,
    admins,
    normalUsers,
    bannedUsers,
    totalBalance
  };
}

/*
========================================
 MAIN HANDLER
========================================
*/

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  try {

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {
      return res.status(500).json({
        success: false,
        message:
          "إعدادات Supabase غير موجودة في Vercel"
      });
    }

    if (!ADMIN_SESSION_SECRET) {
      return res.status(500).json({
        success: false,
        message:
          "ADMIN_SESSION_SECRET غير موجود في Vercel"
      });
    }

    const body =
      normalizeBody(req);

    /*
    ================================
       التحقق من الإدارة
    ================================
    */

    const auth =
      await verifyAdmin(body, req);

    if (!auth.ok) {
      return res.status(403).json({
        success: false,
        message:
          "❌ " +
          (
            auth.message ||
            "ليس لديك صلاحية الإدارة"
          )
      });
    }

    const action =
      String(
        body.action || "stats"
      ).trim();

    /*
    ================================
       الإحصائيات
    ================================
    */

    if (action === "stats") {

      const stats =
        await statistics();

      return res.status(200).json({
        success: true,
        stats
      });
    }

    /*
    ================================
       الأعضاء
    ================================
    */

    if (action === "users") {

      const search =
        String(
          body.search || ""
        ).trim();

      const users =
        await getUsers(search);

      return res.status(200).json({
        success: true,
        users
      });
    }

    /*
    ================================
       معلومات عضو
    ================================
    */

    if (action === "user") {

      const userId =
        body.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      const user =
        await getUser(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      return res.status(200).json({
        success: true,
        user
      });
    }

    /*
    ================================
       إضافة رصيد
    ================================
    */

    if (action === "add_balance") {

      const userId =
        body.userId;

      const amount =
        Number(body.amount);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "المبلغ غير صحيح"
        });
      }

      const user =
        await getUser(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const oldBalance =
        Number(user.balance || 0);

      const newBalance =
        oldBalance + amount;

      const updated =
        await updateUser(
          userId,
          {
            balance: newBalance
          }
        );

      return res.status(200).json({
        success: true,
        message:
          `✅ تمت إضافة ${amount} إلى رصيد العضو`,
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       خصم رصيد
    ================================
    */

    if (action === "remove_balance") {

      const userId =
        body.userId;

      const amount =
        Number(body.amount);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "المبلغ غير صحيح"
        });
      }

      const user =
        await getUser(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const oldBalance =
        Number(user.balance || 0);

      if (oldBalance < amount) {
        return res.status(400).json({
          success: false,
          message: "رصيد العضو غير كافٍ"
        });
      }

      const newBalance =
        oldBalance - amount;

      const updated =
        await updateUser(
          userId,
          {
            balance: newBalance
          }
        );

      return res.status(200).json({
        success: true,
        message:
          `✅ تم خصم ${amount} من رصيد العضو`,
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       تحديد الرصيد
    ================================
    */

    if (action === "set_balance") {

      const userId =
        body.userId;

      const balance =
        Number(body.balance);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        !Number.isFinite(balance) ||
        balance < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "الرصيد غير صحيح"
        });
      }

      const updated =
        await updateUser(
          userId,
          {
            balance
          }
        );

      return res.status(200).json({
        success: true,
        message: "✅ تم تعديل الرصيد",
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       تغيير الدور
    ================================
    */

    if (action === "set_role") {

      const userId =
        body.userId;

      const role =
        String(
          body.role || "user"
        ).toLowerCase();

      const allowedRoles = [
        "user",
        "admin"
      ];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        !allowedRoles.includes(role)
      ) {
        return res.status(400).json({
          success: false,
          message: "الدور غير صالح"
        });
      }

      if (
        auth.id &&
        String(auth.id) === String(userId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "❌ لا يمكنك تغيير دور حساب الإدارة الحالي"
        });
      }

      const updated =
        await updateUser(
          userId,
          {
            role
          }
        );

      return res.status(200).json({
        success: true,
        message:
          role === "admin"
            ? "👑 تم تحويل العضو إلى مدير"
            : "👤 تم تحويل العضو إلى مستخدم",
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       حظر عضو
    ================================
    */

    if (action === "ban_user") {

      const userId =
        body.userId;

      const reason =
        String(
          body.ban_reason ||
          body.reason ||
          "تم الحظر بواسطة الإدارة"
        ).trim();

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        auth.id &&
        String(auth.id) === String(userId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "❌ لا يمكنك حظر حساب الإدارة الحالي"
        });
      }

      const user =
        await getUser(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const updated =
        await updateUser(
          userId,
          {
            banned: true,
            ban_reason: reason
          }
        );

      return res.status(200).json({
        success: true,
        message: "🚫 تم حظر العضو بنجاح",
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       إلغاء حظر عضو
    ================================
    */

    if (action === "unban_user") {

      const userId =
        body.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      const user =
        await getUser(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const updated =
        await updateUser(
          userId,
          {
            banned: false,
            ban_reason: null
          }
        );

      return res.status(200).json({
        success: true,
        message: "✅ تم إلغاء حظر العضو",
        user:
          Array.isArray(updated)
            ? updated[0]
            : updated
      });
    }

    /*
    ================================
       حذف عضو
    ================================
    */

    if (action === "delete_user") {

      const userId =
        body.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "معرف العضو مطلوب"
        });
      }

      if (
        auth.id &&
        String(auth.id) === String(userId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "❌ لا يمكنك حذف حساب الإدارة الحالي"
        });
      }

      await supabaseRequest(
        `users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "DELETE"
        }
      );

      return res.status(200).json({
        success: true,
        message: "🗑️ تم حذف العضو بنجاح"
      });
    }

    /*
    ================================
       أمر غير معروف
    ================================
    */

    return res.status(400).json({
      success: false,
      message:
        "أمر الإدارة غير معروف: " +
        action
    });

  } catch (error) {

    console.error(
      "Admin API Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "❌ حدث خطأ في لوحة الإدارة",
      details:
        error.message
    });
  }
}
