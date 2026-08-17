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
      price,
      icon
    } = req.body || {};

    if (!username || !productId || !productName || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "بيانات الشراء ناقصة"
      });
    }

    const cleanUsername = String(username).trim();
    const amount = Number(price);

    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم غير صحيح"
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "سعر المنتج غير صحيح"
      });
    }

    /* =========================================
       1. البحث عن المستخدم
    ========================================= */

    let userUrl =
      `${SUPABASE_URL}/rest/v1/users` +
      `?username=eq.${encodeURIComponent(cleanUsername)}` +
      `&select=id,username,balance`;

    if (userId !== undefined && userId !== null) {
      userUrl =
        `${SUPABASE_URL}/rest/v1/users` +
        `?id=eq.${encodeURIComponent(userId)}` +
        `&username=eq.${encodeURIComponent(cleanUsername)}` +
        `&select=id,username,balance`;
    }

    const userResponse = await fetch(userUrl, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const userText = await userResponse.text();

    if (!userResponse.ok) {
      console.error("Supabase user error:", userText);

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
        message: "استجابة غير صحيحة من قاعدة البيانات"
      });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const user = users[0];

    const currentBalance = Number(user.balance || 0);

    /* =========================================
       2. التأكد من الرصيد
    ========================================= */

    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "❌ رصيدك غير كافٍ",
        balance: currentBalance
      });
    }

    const newBalance = currentBalance - amount;

    /* =========================================
       3. خصم السعر من الرصيد
    ========================================= */

    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          balance: newBalance
        })
      }
    );

    const updateText = await updateResponse.text();

    if (!updateResponse.ok) {
      console.error(
        "Supabase balance update error:",
        updateText
      );

      return res.status(500).json({
        success: false,
        message: "❌ تعذر خصم المبلغ من الرصيد"
      });
    }

    let updatedUsers = [];

    try {
      updatedUsers = JSON.parse(updateText);
    } catch {
      updatedUsers = [];
    }

    const updatedUser =
      Array.isArray(updatedUsers) && updatedUsers.length
        ? updatedUsers[0]
        : null;

    /* =========================================
       4. إضافة المنتج إلى المخزون
       
       جدول inventory يجب أن يحتوي على:
       id
       user_id
       product_id
       product_name
       icon
       quantity
    ========================================= */

    const inventorySearchResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&product_id=eq.${encodeURIComponent(String(productId))}` +
      `&select=id,user_id,product_id,product_name,icon,quantity`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const inventorySearchText =
      await inventorySearchResponse.text();

    if (!inventorySearchResponse.ok) {

      console.error(
        "Inventory search error:",
        inventorySearchText
      );

      /*
        الرصيد تم خصمه بالفعل.
        لا نعيد العملية مرة ثانية.
      */

      return res.status(500).json({
        success: false,
        message:
          "تم خصم الرصيد، لكن تعذر تحديث المخزون. راجع جدول inventory."
      });
    }

    let inventoryItems = [];

    try {
      inventoryItems =
        JSON.parse(inventorySearchText);
    } catch {
      inventoryItems = [];
    }

    /* =========================================
       5. المنتج موجود مسبقًا
       زيادة الكمية
    ========================================= */

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

      const inventoryUpdateResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory` +
          `?id=eq.${encodeURIComponent(inventoryItem.id)}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_SECRET_KEY,
              Authorization:
                `Bearer ${SUPABASE_SECRET_KEY}`,
              "Content-Type":
                "application/json",
              Prefer:
                "return=representation"
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

        return res.status(500).json({
          success: false,
          message:
            "تم خصم الرصيد، لكن تعذر زيادة كمية المنتج في المخزون."
        });
      }

    } else {

      /* =========================================
         6. المنتج غير موجود
         إنشاء عنصر جديد
      ========================================= */

      const inventoryInsertResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/inventory`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_SECRET_KEY,
              Authorization:
                `Bearer ${SUPABASE_SECRET_KEY}`,
              "Content-Type":
                "application/json",
              Prefer:
                "return=representation"
            },
            body: JSON.stringify({
              user_id: user.id,
              product_id: String(productId),
              product_name: String(productName),
              icon: String(icon || "📦"),
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

        return res.status(500).json({
          success: false,
          message:
            "تم خصم الرصيد، لكن تعذر إضافة المنتج إلى المخزون."
        });
      }
    }

    /* =========================================
       7. تسجيل عملية الشراء
       
       إذا كان جدول transactions موجودًا
    ========================================= */

    try {

      await fetch(
        `${SUPABASE_URL}/rest/v1/transactions`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            user_id: user.id,
            type: "purchase",
            amount: amount,
            description:
              `شراء ${String(productName)}`
          })
        }
      );

    } catch (transactionError) {

      console.warn(
        "Transaction log skipped:",
        transactionError
      );

    }

    /* =========================================
       8. النتيجة النهائية
    ========================================= */

    const finalBalance =
      updatedUser
        ? Number(updatedUser.balance || 0)
        : newBalance;

    return res.status(200).json({
      success: true,

      message:
        `✅ تم شراء ${String(productName)} وخصم ${amount.toLocaleString("ar-EG")} 💰`,

      purchase: {
        productId: String(productId),
        item: String(productName),
        icon: String(icon || "📦"),
        price: amount,
        quantityAdded: 1
      },

      user: {
        id: user.id,
        username: user.username,
        balance: finalBalance
      }
    });

  } catch (error) {

    console.error(
      "Purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "❌ حدث خطأ غير متوقع في عملية الشراء"
    });
  }
}
