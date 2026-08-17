import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
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

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    response,
    data,
    text
  };
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
        message: "إعدادات Supabase غير موجودة"
      });
    }

    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          message: "بيانات الطلب غير صحيحة"
        });
      }
    }

    const adminId = body.adminId;
    const targetUserId = body.targetUserId;
    const action = String(body.action || "").trim();
    const amount = Number(body.amount || 0);
    const details = String(body.details || "").trim();

    if (!adminId || !action) {
      return res.status(400).json({
        success: false,
        message: "بيانات الإدارة ناقصة"
      });
    }

    // التحقق من أن الحساب Admin
    const adminResult = await supabaseRequest(
      `users?id=eq.${encodeURIComponent(adminId)}&select=id,username,role,balance`
    );

    if (!adminResult.response.ok) {
      console.error(
        "Admin lookup error:",
        adminResult.response.status,
        adminResult.text
      );

      return res.status(500).json({
        success: false,
        message: "تعذر التحقق من حساب الإدارة",
        details: adminResult.text
      });
    }

    if (
      !Array.isArray(adminResult.data) ||
      adminResult.data.length === 0
    ) {
      return res.status(403).json({
        success: false,
        message: "حساب الإدارة غير موجود"
      });
    }

    const admin = adminResult.data[0];

    const role = String(
      admin.role || "user"
    ).toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "administrator" ||
      role === "owner";

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "❌ ليس لديك صلاحيات الإدارة"
      });
    }

    // العمليات التي تحتاج عضوًا مستهدفًا
    const targetRequiredActions = [
      "add_balance",
      "remove_balance",
      "set_role",
      "delete_user"
    ];

    if (
      targetRequiredActions.includes(action) &&
      !targetUserId
    ) {
      return res.status(400).json({
        success: false,
        message: "يجب تحديد العضو المستهدف"
      });
    }

    // إضافة رصيد
    if (action === "add_balance") {
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "مبلغ الإضافة غير صحيح"
        });
      }

      const targetResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}&select=id,username,balance`
      );

      if (
        !targetResult.response.ok ||
        !Array.isArray(targetResult.data) ||
        targetResult.data.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const target = targetResult.data[0];
      const newBalance =
        Number(target.balance || 0) + amount;

      const updateResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}`,
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

      if (!updateResult.response.ok) {
        return res.status(500).json({
          success: false,
          message: "تعذر إضافة الرصيد",
          details: updateResult.text
        });
      }

      await supabaseRequest("admin_transactions", {
        method: "POST",
        body: JSON.stringify({
          admin_id: admin.id,
          target_user_id: target.id,
          action: "add_balance",
          amount,
          details:
            details || `إضافة ${amount} إلى حساب ${target.username}`
        })
      });

      return res.status(200).json({
        success: true,
        message: `✅ تمت إضافة ${amount} إلى ${target.username}`,
        balance: newBalance
      });
    }

    // خصم رصيد
    if (action === "remove_balance") {
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "مبلغ الخصم غير صحيح"
        });
      }

      const targetResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}&select=id,username,balance`
      );

      if (
        !targetResult.response.ok ||
        !Array.isArray(targetResult.data) ||
        targetResult.data.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "العضو غير موجود"
        });
      }

      const target = targetResult.data[0];

      const currentBalance =
        Number(target.balance || 0);

      if (currentBalance < amount) {
        return res.status(400).json({
          success: false,
          message: "رصيد العضو لا يكفي"
        });
      }

      const newBalance =
        currentBalance - amount;

      const updateResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}`,
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

      if (!updateResult.response.ok) {
        return res.status(500).json({
          success: false,
          message: "تعذر خصم الرصيد",
          details: updateResult.text
        });
      }

      await supabaseRequest("admin_transactions", {
        method: "POST",
        body: JSON.stringify({
          admin_id: admin.id,
          target_user_id: target.id,
          action: "remove_balance",
          amount,
          details:
            details || `خصم ${amount} من حساب ${target.username}`
        })
      });

      return res.status(200).json({
        success: true,
        message: `✅ تم خصم ${amount} من ${target.username}`,
        balance: newBalance
      });
    }

    // تغيير الدور
    if (action === "set_role") {
      const newRole =
        String(body.role || "user")
          .trim()
          .toLowerCase();

      const allowedRoles = [
        "user",
        "admin",
        "owner"
      ];

      if (!allowedRoles.includes(newRole)) {
        return res.status(400).json({
          success: false,
          message: "الدور غير صالح"
        });
      }

      const updateResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}`,
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            role: newRole
          })
        }
      );

      if (!updateResult.response.ok) {
        return res.status(500).json({
          success: false,
          message: "تعذر تغيير رتبة العضو",
          details: updateResult.text
        });
      }

      await supabaseRequest("admin_transactions", {
        method: "POST",
        body: JSON.stringify({
          admin_id: admin.id,
          target_user_id: targetUserId,
          action: "set_role",
          amount: 0,
          details:
            details || `تغيير الدور إلى ${newRole}`
        })
      });

      return res.status(200).json({
        success: true,
        message: `👑 تم تغيير دور العضو إلى ${newRole}`
      });
    }

    // حذف حساب
    if (action === "delete_user") {
      if (String(admin.id) === String(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "لا يمكنك حذف حساب الإدارة الذي تستخدمه"
        });
      }

      const deleteResult = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(targetUserId)}`,
        {
          method: "DELETE"
        }
      );

      if (!deleteResult.response.ok) {
        return res.status(500).json({
          success: false,
          message: "تعذر حذف الحساب",
          details: deleteResult.text
        });
      }

      await supabaseRequest("admin_transactions", {
        method: "POST",
        body: JSON.stringify({
          admin_id: admin.id,
          target_user_id: targetUserId,
          action: "delete_user",
          amount: 0,
          details:
            details || "حذف حساب عضو"
        })
      });

      return res.status(200).json({
        success: true,
        message: "🗑️ تم حذف الحساب"
      });
    }

    return res.status(400).json({
      success: false,
      message: "عملية الإدارة غير معروفة"
    });

  } catch (error) {
    console.error("Admin API error:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في خادم الإدارة",
      details: error.message
    });
  }
}
