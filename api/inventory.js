const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

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

    const body = req.body || {};

    const userId = body.userId;
    const username = body.username;
    const action = body.action || "list";
    const productId = body.productId;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        message: "بيانات المستخدم ناقصة"
      });
    }

    const headers = {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    /* =========================
       البحث عن المستخدم
    ========================= */

    let userUrl;

    if (userId) {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users` +
        `?id=eq.${encodeURIComponent(userId)}` +
        `&select=id,username,balance`;
    } else {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users` +
        `?username=eq.${encodeURIComponent(String(username).trim())}` +
        `&select=id,username,balance`;
    }

    const userResponse = await fetch(userUrl, {
      method: "GET",
      headers
    });

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("Supabase user error:", userText);

      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى بيانات المستخدم"
      });
    }

    let users;

    try {
      users = JSON.parse(userText);
    } catch (error) {
      console.error("User JSON error:", userText);

      return res.status(500).json({
        success: false,
        message: "استجابة المستخدم من Supabase غير صحيحة"
      });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    /* =========================
       استخدام المنتج
    ========================= */

    if (action === "use") {
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "معرف المنتج ناقص"
        });
      }

      const itemUrl =
        `${SUPABASE_URL}/rest/v1/inventory` +
        `?id=eq.${encodeURIComponent(productId)}` +
        `&user_id=eq.${encodeURIComponent(user.id)}` +
        `&select=id,user_id,item_name,item_type,quantity`;

      const itemResponse = await fetch(itemUrl, {
        method: "GET",
        headers
      });

      const itemText = await itemResponse.text();

      if (!itemResponse.ok) {
        console.error("Inventory item error:", itemText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى المنتج"
        });
      }

      let itemRows;

      try {
        itemRows = JSON.parse(itemText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة المخزون غير صحيحة"
        });
      }

      if (!Array.isArray(itemRows) || itemRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "المنتج غير موجود في المخزون"
        });
      }

      const item = itemRows[0];
      const quantity = Number(item.quantity || 0);

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "كمية المنتج غير كافية"
        });
      }

      /* إذا كانت الكمية 1 نحذف السجل */

      if (quantity === 1) {
        const deleteResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "DELETE",
            headers
          }
        );

        const deleteText = await deleteResponse.text();

        if (!deleteResponse.ok) {
          console.error("Delete inventory error:", deleteText);

          return res.status(500).json({
            success: false,
            message: "تعذر استخدام المنتج"
          });
        }
      } else {
        /* تقليل الكمية */

        const updateResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            headers: {
              ...headers,
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              quantity: quantity - 1
            })
          }
        );

        const updateText = await updateResponse.text();

        if (!updateResponse.ok) {
          console.error("Update inventory error:", updateText);

          return res.status(500).json({
            success: false,
            message: "تعذر تحديث كمية المنتج"
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `✅ تم استخدام ${item.item_name}`,
        item: {
          id: item.id,
          item_name: item.item_name,
          item_type: item.item_type
        }
      });
    }

    /* =========================
       عرض المخزون
    ========================= */

    const inventoryUrl =
      `${SUPABASE_URL}/rest/v1/inventory` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=id,user_id,item_name,item_type,quantity,created_at` +
      `&order=created_at.desc`;

    const inventoryResponse = await fetch(inventoryUrl, {
      method: "GET",
      headers
    });

    const inventoryText = await inventoryResponse.text();

    if (!inventoryResponse.ok) {
      console.error("Supabase inventory error:", inventoryText);

      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى المخزون"
      });
    }

    let inventory;

    try {
      inventory = JSON.parse(inventoryText);
    } catch {
      console.error("Inventory JSON error:", inventoryText);

      return res.status(500).json({
        success: false,
        message: "استجابة المخزون من Supabase غير صحيحة"
      });
    }

    if (!Array.isArray(inventory)) {
      inventory = [];
    }

    /* =========================
       النتيجة
    ========================= */

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      },

      items: inventory
    });

  } catch (error) {
    console.error("Inventory API error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في خادم المخزون"
    });
  }
}
