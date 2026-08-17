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

    const {
      userId,
      username,
      action,
      productId,
      itemName,
      itemType,
      quantity
    } = body;

    // =====================================================
    // التحقق من المستخدم
    // =====================================================

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        message: "بيانات المستخدم ناقصة"
      });
    }

    // =====================================================
    // العثور على المستخدم
    // =====================================================

    let user = null;

    if (userId) {
      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const userText = await userResponse.text();

      if (!userResponse.ok) {
        console.error("User lookup error:", userText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى حساب المستخدم"
        });
      }

      let users = [];

      try {
        users = JSON.parse(userText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة غير صحيحة من قاعدة البيانات"
        });
      }

      if (Array.isArray(users) && users.length > 0) {
        user = users[0];
      }
    }

    if (!user && username) {
      const cleanUsername = String(username).trim();

      const userResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(cleanUsername)}&select=id,username,balance`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const userText = await userResponse.text();

      if (!userResponse.ok) {
        console.error("Username lookup error:", userText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى حساب المستخدم"
        });
      }

      let users = [];

      try {
        users = JSON.parse(userText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة غير صحيحة من قاعدة البيانات"
        });
      }

      if (Array.isArray(users) && users.length > 0) {
        user = users[0];
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    // =====================================================
    // استخدام منتج من المخزون
    // =====================================================

    if (action === "use") {
      if (!productId && !itemName) {
        return res.status(400).json({
          success: false,
          message: "لم يتم تحديد المنتج"
        });
      }

      let query = "";

      if (productId) {
        query =
          `${SUPABASE_URL}/rest/v1/inventory` +
          `?id=eq.${encodeURIComponent(productId)}` +
          `&user_id=eq.${encodeURIComponent(user.id)}` +
          `&select=id,user_id,item_name,item_type,quantity,created_at`;
      } else {
        query =
          `${SUPABASE_URL}/rest/v1/inventory` +
          `?user_id=eq.${encodeURIComponent(user.id)}` +
          `&item_name=eq.${encodeURIComponent(String(itemName))}` +
          `&select=id,user_id,item_name,item_type,quantity,created_at`;
      }

      const inventoryResponse = await fetch(query, {
        method: "GET",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      const inventoryText = await inventoryResponse.text();

      if (!inventoryResponse.ok) {
        console.error("Inventory lookup error:", inventoryText);

        return res.status(500).json({
          success: false,
          message: "تعذر الوصول إلى المخزون"
        });
      }

      let items = [];

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
      const currentQuantity = Number(item.quantity || 0);

      if (currentQuantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "لا توجد كمية كافية من هذا المنتج"
        });
      }

      // إذا كانت الكمية 1 نحذف السجل
      if (currentQuantity === 1) {
        const deleteResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
              "Content-Type": "application/json"
            }
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
        // إن كانت الكمية أكثر من 1 نقللها واحدًا
        const updateResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              quantity: currentQuantity - 1
            })
          }
        );

        const updateText = await updateResponse.text();

        if (!updateResponse.ok) {
          console.error("Inventory quantity update error:", updateText);

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
          item_type: item.item_type,
          remaining: Math.max(0, currentQuantity - 1)
        },
        user: {
          id: user.id,
          username: user.username,
          balance: Number(user.balance || 0)
        }
      });
    }

    // =====================================================
    // إضافة منتج إلى المخزون
    // يستخدمه purchase.js أو أي API آخر
    // =====================================================

    if (action === "add") {
      if (!itemName) {
        return res.status(400).json({
          success: false,
          message: "اسم المنتج غير موجود"
        });
      }

      const addQuantity =
        Number(quantity || 1);

      if (
        !Number.isInteger(addQuantity) ||
        addQuantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "الكمية غير صحيحة"
        });
      }

      const cleanItemName =
        String(itemName).trim();

      const cleanItemType =
        String(itemType || "product").trim();

      // البحث عن المنتج الموجود مسبقًا
      const existingResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/inventory` +
        `?user_id=eq.${encodeURIComponent(user.id)}` +
        `&item_name=eq.${encodeURIComponent(cleanItemName)}` +
        `&select=id,user_id,item_name,item_type,quantity,created_at`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const existingText =
        await existingResponse.text();

      if (!existingResponse.ok) {
        console.error(
          "Existing inventory error:",
          existingText
        );

        return res.status(500).json({
          success: false,
          message: "تعذر فحص المخزون"
        });
      }

      let existingItems = [];

      try {
        existingItems =
          JSON.parse(existingText);
      } catch {
        return res.status(500).json({
          success: false,
          message: "استجابة المخزون غير صحيحة"
        });
      }

      // المنتج موجود → زيادة الكمية
      if (
        Array.isArray(existingItems) &&
        existingItems.length > 0
      ) {
        const existing =
          existingItems[0];

        const newQuantity =
          Number(existing.quantity || 0) +
          addQuantity;

        const updateResponse =
          await fetch(
            `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(existing.id)}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SECRET_KEY,
                Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              },
              body: JSON.stringify({
                quantity: newQuantity
              })
            }
          );

        const updateText =
          await updateResponse.text();

        if (!updateResponse.ok) {
          console.error(
            "Inventory add update error:",
            updateText
          );

          return res.status(500).json({
            success: false,
            message: "تعذر إضافة المنتج للمخزون"
          });
        }

        let updated = [];

        try {
          updated =
            JSON.parse(updateText);
        } catch {
          updated = [];
        }

        return res.status(200).json({
          success: true,
          message: `✅ تمت إضافة ${cleanItemName} إلى المخزون`,
          item:
            Array.isArray(updated) &&
            updated.length
              ? updated[0]
              : {
                  id: existing.id,
                  user_id: user.id,
                  item_name: cleanItemName,
                  item_type: cleanItemType,
                  quantity: newQuantity
                },
          user: {
            id: user.id,
            username: user.username,
            balance: Number(user.balance || 0)
          }
        });
      }

      // المنتج غير موجود → إنشاء سجل جديد
      const insertResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              user_id: user.id,
              item_name: cleanItemName,
              item_type: cleanItemType,
              quantity: addQuantity
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

        return res.status(500).json({
          success: false,
          message: "تعذر إنشاء المنتج في المخزون"
        });
      }

      let inserted = [];

      try {
        inserted =
          JSON.parse(insertText);
      } catch {
        inserted = [];
      }

      return res.status(200).json({
        success: true,
        message: `✅ تمت إضافة ${cleanItemName} إلى المخزون`,
        item:
          Array.isArray(inserted) &&
          inserted.length
            ? inserted[0]
            : null,
        user: {
          id: user.id,
          username: user.username,
          balance: Number(user.balance || 0)
        }
      });
    }

    // =====================================================
    // عرض المخزون
    // =====================================================

    const inventoryResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/inventory` +
        `?user_id=eq.${encodeURIComponent(user.id)}` +
        `&select=id,user_id,item_name,item_type,quantity,created_at` +
        `&order=created_at.desc`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

    const inventoryText =
      await inventoryResponse.text();

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

    let inventory = [];

    try {
      inventory =
        JSON.parse(inventoryText);
    } catch {
      return res.status(500).json({
        success: false,
        message: "بيانات المخزون غير صحيحة"
      });
    }

    return res.status(200).json({
      success: true,
      items: Array.isArray(inventory)
        ? inventory
        : [],
      inventory: Array.isArray(inventory)
        ? inventory
        : [],
      user: {
        id: user.id,
        username: user.username,
        balance: Number(user.balance || 0)
      }
    });

  } catch (error) {
    console.error("Inventory API error:", error);

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في خادم المخزون"
    });
  }
}
