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

    const body = req.body || {};

    const action = body.action || "list";
    const username = String(body.username || "").trim();
    const userId = body.userId;
    const productId = body.productId;

    if (!username && !userId) {
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

    // =====================================================
    // البحث عن المستخدم
    // =====================================================

    let userUrl;

    if (userId) {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`;
    } else {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id,username,balance`;
    }

    const userResponse = await fetch(userUrl, {
      method: "GET",
      headers
    });

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("User lookup error:", userText);

      return res.status(500).json({
        success: false,
        message: "تعذر الوصول إلى المستخدم"
      });
    }

    let users;

    try {
      users = JSON.parse(userText);
    } catch {
      return res.status(500).json({
        success: false,
        message: "استجابة المستخدم غير صحيحة"
      });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    // =====================================================
    // استخدام منتج
    // =====================================================

    if (action === "use") {

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "معرف المنتج غير موجود"
        });
      }

      const inventoryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/inventory?user_id=eq.${encodeURIComponent(user.id)}&id=eq.${encodeURIComponent(productId)}&select=id,user_id,item_name,item_type,quantity`,
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

      let inventoryItems;

      try {
        inventoryItems = JSON.parse(inventoryText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة المخزون غير صحيحة"
        });
      }

      if (
        !Array.isArray(inventoryItems) ||
        inventoryItems.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "المنتج غير موجود في المخزون"
        });
      }

      const inventoryItem = inventoryItems[0];
      const quantity = Number(inventoryItem.quantity || 0);

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "لا توجد كمية كافية من المنتج"
        });
      }

      // إذا كانت الكمية أكثر من 1 نقللها
      if (quantity > 1) {

        const updateInventory = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(inventoryItem.id)}`,
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

        const updateText = await updateInventory.text();

        if (!updateInventory.ok) {
          console.error(
            "Inventory quantity update error:",
            updateText
          );

          return res.status(500).json({
            success: false,
            message: "تعذر تحديث كمية المنتج"
          });
        }

      } else {

        // إذا كانت آخر قطعة نحذفها
        const deleteInventory = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(inventoryItem.id)}`,
          {
            method: "DELETE",
            headers
          }
        );

        const deleteText = await deleteInventory.text();

        if (!deleteInventory.ok) {
          console.error(
            "Inventory delete error:",
            deleteText
          );

          return res.status(500).json({
            success: false,
            message: "تعذر حذف المنتج من المخزون"
          });
        }

      }

      return res.status(200).json({
        success: true,
        message: `✅ تم استخدام ${inventoryItem.item_name}`
      });
    }

    // =====================================================
    // عرض المخزون
    // =====================================================

    const inventoryResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,item_name,item_type,quantity,created_at&order=created_at.desc`,
      {
        method: "GET",
        headers
      }
    );

    const inventoryText = await inventoryResponse.text();

    if (!inventoryResponse.ok) {
      console.error(
        "Inventory fetch error:",
        inventoryText
      );

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

    if (!Array.isArray(items)) {
      items = [];
    }

    // =====================================================
    // تحويل بيانات Supabase إلى الشكل الذي يفهمه index.html
    // =====================================================

    const inventory = items.map(item => ({
      id: item.id,
      user_id: item.user_id,
      product_id: item.id,
      productId: item.id,

      item_name: item.item_name,
      product_name: item.item_name,
      productName: item.item_name,
      name: item.item_name,

      item_type: item.item_type || "product",

      quantity: Number(item.quantity || 0),
      count: Number(item.quantity || 0),

      created_at: item.created_at
    }));

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      },

      items: inventory,
      inventory: inventory
    });

  } catch (error) {

    console.error("Inventory API error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في خادم المخزون"
    });
  }
}
