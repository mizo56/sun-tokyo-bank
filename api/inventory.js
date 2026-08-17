
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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
      action,
      userId,
      username,
      productId
    } = req.body || {};

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        message: "بيانات المستخدم ناقصة"
      });
    }

    const headers = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    /* =========================
       تحديد المستخدم
    ========================= */

    let user;

    if (userId) {
      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET",
          headers
        }
      );

      const userText = await userResponse.text();

      if (!userResponse.ok) {
        console.error("User lookup error:", userText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى بيانات المستخدم"
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
        return res.status(404).json({
          success: false,
          message: "المستخدم غير موجود"
        });
      }

      user = users[0];

    } else {

      const cleanUsername = String(username).trim();

      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username,balance`,
        {
          method: "GET",
          headers
        }
      );

      const userText = await userResponse.text();

      if (!userResponse.ok) {
        console.error("User lookup error:", userText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى بيانات المستخدم"
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
        return res.status(404).json({
          success: false,
          message: "المستخدم غير موجود"
        });
      }

      user = users[0];
    }

    /* =========================
       استخدام منتج
    ========================= */

    if (action === "use") {

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "معرف المنتج ناقص"
        });
      }

      const inventoryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(productId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,item_name,item_type,quantity`,
        {
          method: "GET",
          headers
        }
      );

      const inventoryText = await inventoryResponse.text();

      if (!inventoryResponse.ok) {
        console.error("Inventory lookup error:", inventoryText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى المخزون"
        });
      }

      let items;

      try {
        items = JSON.parse(inventoryText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة المخزون غير صحيحة"
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(404).json({
          success: false,
          message: "المنتج غير موجود في المخزون"
        });
      }

      const item = items[0];
      const quantity = Number(item.quantity || 0);

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "لا توجد كمية كافية من المنتج"
        });
      }

      /* تقليل الكمية */

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
          console.error("Inventory delete error:", deleteText);

          return res.status(500).json({
            success: false,
            message: "تعذر استخدام المنتج"
          });
        }

      } else {

        const updateResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            headers: {
              ...headers,
              "Prefer": "return=representation"
            },
            body: JSON.stringify({
              quantity: quantity - 1
            })
          }
        );

        const updateText = await updateResponse.text();

        if (!updateResponse.ok) {
          console.error("Inventory update error:", updateText);

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
          name: item.item_name,
          type: item.item_type
        }
      });
    }

    /* =========================
       عرض المخزون
    ========================= */

    const inventoryResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,item_name,item_type,quantity,created_at&order=created_at.desc`,
      {
        method: "GET",
        headers
      }
    );

    const inventoryText = await inventoryResponse.text();

    if (!inventoryResponse.ok) {
      console.error("Inventory error:", inventoryText);

      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى المخزون"
      });
    }

    let items;

    try {
      items = JSON.parse(inventoryText);
    } catch {
      return res.status(500).json({
        success: false,
        message: "استجابة المخزون غير صحيحة"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      },
      items: Array.isArray(items) ? items : []
    });

  } catch (error) {

    console.error("Inventory API error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في خادم المخزون"
    });
  }
}
