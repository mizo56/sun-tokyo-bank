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
      userId,
      username,
      productId,
      productName,
      item,
      price,
      icon
    } = req.body || {};

    const cleanUsername =
      username ? String(username).trim() : "";

    const cleanProductName =
      productName || item
        ? String(productName || item).trim()
        : "";

    const amount = Number(price);

    if (!cleanUsername && !userId) {
      return res.status(400).json({
        success: false,
        message: "المستخدم غير محدد"
      });
    }

    if (!cleanProductName) {
      return res.status(400).json({
        success: false,
        message: "اسم المنتج غير موجود"
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "سعر المنتج غير صحيح"
      });
    }

    const headers = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json"
    };

    // =====================================================
    // 1 — البحث عن المستخدم
    // =====================================================

    let users = [];

    if (userId) {
      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET",
          headers
        }
      );

      const text = await userResponse.text();

      if (!userResponse.ok) {
        console.error("User lookup error:", text);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى حساب المستخدم"
        });
      }

      try {
        users = JSON.parse(text);
      } catch {
        users = [];
      }
    }

    if (!users.length && cleanUsername) {
      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username,balance`,
        {
          method: "GET",
          headers
        }
      );

      const text = await userResponse.text();

      if (!userResponse.ok) {
        console.error("Username lookup error:", text);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى حساب المستخدم"
        });
      }

      try {
        users = JSON.parse(text);
      } catch {
        users = [];
      }
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "❌ المستخدم غير موجود"
      });
    }

    const user = users[0];

    const currentBalance =
      Number(user.balance || 0);

    // =====================================================
    // 2 — التأكد من الرصيد
    // =====================================================

    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "❌ رصيدك غير كافٍ",
        balance: currentBalance
      });
    }

    const newBalance =
      currentBalance - amount;

    // =====================================================
    // 3 — خصم السعر من الرصيد
    // =====================================================

    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText =
      await updateResponse.text();

    if (!updateResponse.ok) {
      console.error(
        "Balance update error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        message: "❌ تعذر خصم المبلغ من الرصيد"
      });
    }

    // =====================================================
    // 4 — البحث عن المنتج داخل المخزون
    // =====================================================

    const inventoryResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory?user_id=eq.${encodeURIComponent(user.id)}&item_name=eq.${encodeURIComponent(cleanProductName)}&select=id,user_id,item_name,item_type,quantity`,
      {
        method: "GET",
        headers
      }
    );

    const inventoryText =
      await inventoryResponse.text();

    if (!inventoryResponse.ok) {
      console.error(
        "Inventory lookup error:",
        inventoryText
      );

      // إعادة الرصيد إذا فشل المخزون
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            balance: currentBalance
          })
        }
      );

      return res.status(500).json({
        success: false,
        message: "❌ تعذر الوصول إلى المخزون وتم إلغاء عملية الشراء"
      });
    }

    let inventoryItems = [];

    try {
      inventoryItems =
        JSON.parse(inventoryText);
    } catch {
      inventoryItems = [];
    }

    // =====================================================
    // 5 — إذا المنتج موجود نزيد الكمية
    // =====================================================

    if (
      Array.isArray(inventoryItems) &&
      inventoryItems.length > 0
    ) {
      const inventoryItem =
        inventoryItems[0];

      const oldQuantity =
        Number(inventoryItem.quantity || 0);

      const newQuantity =
        oldQuantity + 1;

      const inventoryUpdate =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(inventoryItem.id)}`,
          {
            method: "PATCH",
            headers: {
              ...headers,
              "Prefer": "return=representation"
            },
            body: JSON.stringify({
              quantity: newQuantity
            })
          }
        );

      if (!inventoryUpdate.ok) {
        const errorText =
          await inventoryUpdate.text();

        console.error(
          "Inventory update error:",
          errorText
        );

        // إعادة الرصيد
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              balance: currentBalance
            })
          }
        );

        return res.status(500).json({
          success: false,
          message: "❌ تعذر إضافة المنتج للمخزون وتم إعادة الرصيد"
        });
      }

      return res.status(200).json({
        success: true,
        message:
          `✅ تم شراء ${cleanProductName} وإضافته للمخزون`,
        purchase: {
          productId:
            productId || null,
          item:
            cleanProductName,
          price:
            amount,
          quantity:
            newQuantity
        },
        user: {
          id:
            user.id,
          username:
            user.username,
          balance:
            newBalance
        }
      });
    }

    // =====================================================
    // 6 — المنتج غير موجود: إنشاء سجل جديد
    // =====================================================

    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          user_id: user.id,
          item_name: cleanProductName,
          item_type: icon
            ? String(icon)
            : "item",
          quantity: 1
        })
      }
    );

    const insertText =
      await insertResponse.text();

    if (!insertResponse.ok) {
      console.error(
        "Inventory insert error:",
        insertText
      );

      // =================================================
      // إعادة الرصيد إذا فشل إدخال المنتج
      // =================================================

      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            balance: currentBalance
          })
        }
      );

      return res.status(500).json({
        success: false,
        message:
          "❌ تعذر إضافة المنتج للمخزون وتم إعادة الرصيد"
      });
    }

    // =====================================================
    // 7 — نجاح العملية
    // =====================================================

    return res.status(200).json({
      success: true,

      message:
        `✅ تم شراء ${cleanProductName} بنجاح وخصم ${amount.toLocaleString("ar-EG")} 💰`,

      purchase: {
        productId:
          productId || null,

        item:
          cleanProductName,

        price:
          amount,

        quantity:
          1
      },

      user: {
        id:
          user.id,

        username:
          user.username,

        balance:
          newBalance
      }
    });

  } catch (error) {

    console.error(
      "Purchase API error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "❌ حدث خطأ غير متوقع أثناء عملية الشراء"
    });
  }
}
