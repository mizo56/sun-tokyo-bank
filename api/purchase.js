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
      product,
      item,
      price,
      icon
    } = req.body || {};

    const itemName =
      productName ||
      product ||
      item;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        message: "بيانات المستخدم ناقصة"
      });
    }

    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "اسم المنتج غير موجود"
      });
    }

    const amount = Number(price);

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
    // 1. جلب المستخدم
    // =====================================================

    let userUrl;

    if (userId) {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,username,balance`;
    } else {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(
          String(username).trim()
        )}&select=id,username,balance`;
    }

    const userResponse = await fetch(userUrl, {
      method: "GET",
      headers
    });

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("User error:", userText);

      return res.status(500).json({
        success: false,
        message: "تعذر الاتصال بقاعدة البيانات"
      });
    }

    let users;

    try {
      users = JSON.parse(userText);
    } catch {
      return res.status(500).json({
        success: false,
        message: "استجابة قاعدة البيانات غير صحيحة"
      });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    const currentBalance = Number(
      user.balance || 0
    );

    // =====================================================
    // 2. التأكد من الرصيد
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
    // 3. خصم الرصيد
    // =====================================================

    const updateBalanceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(
        user.id
      )}`,
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

    const updateBalanceText =
      await updateBalanceResponse.text();

    if (!updateBalanceResponse.ok) {

      console.error(
        "Balance update error:",
        updateBalanceText
      );

      return res.status(500).json({
        success: false,
        message: "❌ تعذر خصم المبلغ من الرصيد"
      });
    }


    // =====================================================
    // 4. تحديد نوع المنتج
    // =====================================================

    const lowerName =
      String(itemName).toLowerCase();

    let itemType = "item";

    if (
      lowerName.includes("سيف") ||
      lowerName.includes("نصل") ||
      lowerName.includes("رمح") ||
      lowerName.includes("قوس") ||
      lowerName.includes("عصا")
    ) {
      itemType = "weapon";

    } else if (
      lowerName.includes("درع") ||
      lowerName.includes("خوذة") ||
      lowerName.includes("قفازات")
    ) {
      itemType = "armor";

    } else if (
      lowerName.includes("جرعة") ||
      lowerName.includes("علاج")
    ) {
      itemType = "potion";

    } else if (
      lowerName.includes("جوهرة") ||
      lowerName.includes("حجر") ||
      lowerName.includes("بلورة")
    ) {
      itemType = "gem";

    } else if (
      lowerName.includes("خبز") ||
      lowerName.includes("لحم") ||
      lowerName.includes("رامن") ||
      lowerName.includes("سوشي") ||
      lowerName.includes("طعام") ||
      lowerName.includes("شاي")
    ) {
      itemType = "food";

    } else if (
      lowerName.includes("هدية") ||
      lowerName.includes("تذكرة")
    ) {
      itemType = "gift";

    } else if (
      lowerName.includes("خاتم") ||
      lowerName.includes("قلادة") ||
      lowerName.includes("تاج") ||
      lowerName.includes("قناع")
    ) {
      itemType = "accessory";
    }


    // =====================================================
    // 5. البحث عن المنتج في المخزون
    // =====================================================

    const inventorySearchResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/inventory?user_id=eq.${encodeURIComponent(
          user.id
        )}&item_name=eq.${encodeURIComponent(
          String(itemName)
        )}&select=*`,
        {
          method: "GET",
          headers
        }
      );

    const inventorySearchText =
      await inventorySearchResponse.text();

    if (!inventorySearchResponse.ok) {

      console.error(
        "Inventory search error:",
        inventorySearchText
      );

      // محاولة إعادة الرصيد
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(
          user.id
        )}`,
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

    let inventoryItems;

    try {
      inventoryItems =
        JSON.parse(inventorySearchText);
    } catch {
      inventoryItems = [];
    }


    // =====================================================
    // 6. إذا المنتج موجود نزيد الكمية
    // =====================================================

    if (
      Array.isArray(inventoryItems) &&
      inventoryItems.length > 0
    ) {

      const inventoryItem =
        inventoryItems[0];

      const oldQuantity =
        Number(
          inventoryItem.quantity || 0
        );

      const newQuantity =
        oldQuantity + 1;

      const inventoryUpdateResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory?id=eq.${encodeURIComponent(
            inventoryItem.id
          )}`,
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

      const inventoryUpdateText =
        await inventoryUpdateResponse.text();

      if (!inventoryUpdateResponse.ok) {

        console.error(
          "Inventory update error:",
          inventoryUpdateText
        );

        // إعادة الرصيد في حالة فشل الإضافة
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(
            user.id
          )}`,
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
          message: "❌ تعذر إضافة المنتج للمخزون وتم إلغاء الشراء"
        });
      }

    } else {

      // ===================================================
      // 7. المنتج غير موجود → إنشاء عنصر جديد
      // ===================================================

      const inventoryInsertResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory`,
          {
            method: "POST",
            headers: {
              ...headers,
              "Prefer": "return=representation"
            },
            body: JSON.stringify({
              user_id: user.id,
              item_name: String(itemName),
              item_type: itemType,
              quantity: 1
            })
          }
        );

      const inventoryInsertText =
        await inventoryInsertResponse.text();

      if (!inventoryInsertResponse.ok) {

        console.error(
          "Inventory insert error:",
          inventoryInsertText
        );

        // إعادة الرصيد
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(
            user.id
          )}`,
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
          message: "❌ تعذر إضافة المنتج للمخزون وتم إلغاء الشراء"
        });
      }
    }


    // =====================================================
    // 8. نجاح عملية الشراء
    // =====================================================

    return res.status(200).json({

      success: true,

      message:
        `✅ تم شراء ${String(itemName)} وخصم ${amount.toLocaleString(
          "ar-EG"
        )} 💰`,

      purchase: {
        productId:
          productId || null,

        item:
          String(itemName),

        price:
          amount,

        quantityAdded:
          1,

        icon:
          icon || "🎁"
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
      "Purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "❌ حدث خطأ في الخادم أثناء عملية الشراء"
    });
  }
}
