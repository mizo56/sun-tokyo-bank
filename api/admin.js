import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

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

  const response = await fetch(
    supabaseUrl(path),
    {
      ...options,
      headers: {
        ...getHeaders(),
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

    console.error(
      "Supabase Admin Error:",
      response.status,
      text
    );

    throw new Error(
      `Supabase HTTP ${response.status}`
    );
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
   التحقق من الإدارة
========================================
*/

async function verifyAdmin(body) {

  const username = String(
    body.adminUsername || ""
  ).trim();

  const password = String(
    body.adminPassword || ""
  );

  if (!username || !password) {
    return {
      ok: false,
      message: "بيانات الإدارة مطلوبة"
    };
  }

  /*
    إذا تم إعداد ADMIN_USERNAME
    و ADMIN_PASSWORD_HASH في Vercel
  */

  if (
    ADMIN_USERNAME &&
    ADMIN_PASSWORD_HASH
  ) {

    const passwordHash =
      hashPassword(password);

    if (
      username === ADMIN_USERNAME &&
      passwordHash === ADMIN_PASSWORD_HASH
    ) {

      return {
        ok: true,
        username
      };

    }

  }

  /*
    التحقق من حساب الإدارة داخل users
  */

  const encoded =
    encodeURIComponent(username);

  const users =
    await supabaseRequest(
      `users?username=eq.${encoded}` +
      `&select=id,username,password_hash,balance,role`
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
    username: user.username,
    id: user.id
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
    "?select=id,created_at,username,balance,role" +
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
      `&select=id,created_at,username,balance,role`
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
      "users?select=id,balance,role"
    );

  const list =
    Array.isArray(users)
      ? users
      : [];

  let totalBalance = 0;

  let admins = 0;

  let normalUsers = 0;

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

  }

  return {

    users: list.length,

    admins,

    normalUsers,

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

    const body =
      normalizeBody(req);

    /*
    ================================
       التحقق من الإدارة
    ================================
    */

    const auth =
      await verifyAdmin(body);

    if (!auth.ok) {

      return res.status(403).json({
        success: false,
        message:
          "❌ " +
          (auth.message ||
            "ليس لديك صلاحية الإدارة")
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
       قائمة الأعضاء
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

      /*
        منع الإدارة من تغيير نفسها
        عن طريق الخطأ.
      */

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

        message:
          "🗑️ تم حذف العضو بنجاح"

      });

    }


    /*
    ================================
       حظر عضو
    ================================
    */

    if (action === "ban_user") {

      return res.status(400).json({

        success: false,

        message:
          "نظام الحظر يحتاج إضافة عمود banned إلى جدول users أولًا"

      });

    }


    /*
    ================================
       إلغاء حظر عضو
    ================================
    */

    if (action === "unban_user") {

      return res.status(400).json({

        success: false,

        message:
          "نظام الحظر يحتاج إضافة عمود banned إلى جدول users أولًا"

      });

    }


    /*
    ================================
       Action غير معروف
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
