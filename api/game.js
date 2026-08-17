import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const BOXES = {
  box1: {
    price: 100,
    rewards: [
      { icon: "💰", name: "500 عملة", balance: 500 },
      { icon: "💰", name: "750 عملة", balance: 750 },
      { icon: "🎁", name: "هدية برونزية", item: true },
      { icon: "🪙", name: "عملة قديمة", item: true }
    ]
  },

  box2: {
    price: 250,
    rewards: [
      { icon: "💰", name: "1000 عملة", balance: 1000 },
      { icon: "💰", name: "1500 عملة", balance: 1500 },
      { icon: "💎", name: "جوهرة صغيرة", item: true },
      { icon: "🎁", name: "هدية فضية", item: true }
    ]
  },

  box3: {
    price: 500,
    rewards: [
      { icon: "💰", name: "2000 عملة", balance: 2000 },
      { icon: "💎", name: "جوهرة زرقاء", item: true },
      { icon: "⚔️", name: "سيف نادر", item: true },
      { icon: "🎟️", name: "تذكرة ذهبية", item: true }
    ]
  },

  box4: {
    price: 1000,
    rewards: [
      { icon: "💰", name: "4000 عملة", balance: 4000 },
      { icon: "💎", name: "جوهرة ذهبية", item: true },
      { icon: "👑", name: "تاج الملك", item: true },
      { icon: "🏯", name: "مخطط القصر", item: true }
    ]
  },

  box5: {
    price: 2500,
    rewards: [
      { icon: "💰", name: "8000 عملة", balance: 8000 },
      { icon: "🥷", name: "زي النينجا", item: true },
      { icon: "⚔️", name: "سيف القمر", item: true },
      { icon: "👑", name: "تاج الساموراي", item: true }
    ]
  },

  box6: {
    price: 5000,
    rewards: [
      { icon: "💰", name: "15000 عملة", balance: 15000 },
      { icon: "🐉", name: "قلب التنين", item: true },
      { icon: "🔱", name: "رمح الملك", item: true },
      { icon: "🛡️", name: "درع التنين", item: true }
    ]
  },

  box7: {
    price: 10000,
    rewards: [
      { icon: "💰", name: "30000 عملة", balance: 30000 },
      { icon: "💎", name: "حجر التنين", item: true },
      { icon: "⚔️", name: "سيف التنين", item: true },
      { icon: "👑", name: "تاج الشمس", item: true },
      { icon: "📜", name: "سر قديم", item: true }
    ]
  }
};

const GAME_COSTS = {
  dice: 25,
  coin: 40,
  quickbox: 50,
  slots: 75,
  wheel: 100,
  cards: 150,
  treasure: 200,
  boss: 300
};

function json(res, status, data) {
  return res.status(status).json(data);
}

async function supabase(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}${path}`,
    {
      ...options,
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
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
    const error = new Error(
      data?.message ||
      data?.hint ||
      data?.details ||
      "خطأ في Supabase"
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function randomItem(array) {
  return array[
    crypto.randomInt(0, array.length)
  ];
}

function cleanUsername(value) {
  return String(value || "").trim();
}

async function findUser(userId, username) {

  if (userId) {

    const users = await supabase(
      `/rest/v1/users?id=eq.${encodeURIComponent(
        String(userId)
      )}&select=id,username,balance`
    );

    if (Array.isArray(users) && users.length) {
      return users[0];
    }
  }

  if (username) {

    const users = await supabase(
      `/rest/v1/users?username=eq.${encodeURIComponent(
        cleanUsername(username)
      )}&select=id,username,balance`
    );

    if (Array.isArray(users) && users.length) {
      return users[0];
    }
  }

  return null;
}

async function updateBalance(userId, balance) {

  const users = await supabase(
    `/rest/v1/users?id=eq.${encodeURIComponent(
      String(userId)
    )}&select=id,username,balance`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        balance
      })
    }
  );

  if (!Array.isArray(users) || !users.length) {
    throw new Error("تعذر تحديث الرصيد");
  }

  return users[0];
}

async function addTransaction({
  userId,
  username,
  type,
  amount,
  description
}) {

  try {

    await supabase(
      "/rest/v1/transactions",
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          user_id: userId,
          username,
          type,
          amount,
          description
        })
      }
    );

  } catch (error) {

    console.warn(
      "Transaction log skipped:",
      error.message
    );

  }
}

async function addInventoryItem({
  userId,
  username,
  productId,
  productName,
  icon
}) {

  /*
   * يحاول أولًا زيادة كمية العنصر الموجود.
   */

  try {

    const existing = await supabase(
      `/rest/v1/inventory?user_id=eq.${encodeURIComponent(
        String(userId)
      )}&product_id=eq.${encodeURIComponent(
        String(productId)
      )}&select=id,quantity`
    );

    if (Array.isArray(existing) && existing.length) {

      const oldQuantity =
        Number(existing[0].quantity || 0);

      const updated =
        await supabase(
          `/rest/v1/inventory?id=eq.${encodeURIComponent(
            String(existing[0].id)
          )}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              quantity: oldQuantity + 1
            })
          }
        );

      return updated?.[0] || null;
    }

    /*
     * إذا لم يكن العنصر موجودًا يتم إنشاؤه.
     */

    const created =
      await supabase(
        "/rest/v1/inventory",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            user_id: userId,
            username,
            product_id: productId,
            product_name: productName,
            icon,
            quantity: 1
          })
        }
      );

    return created?.[0] || null;

  } catch (error) {

    console.error(
      "Inventory error:",
      error.message
    );

    /*
     * لا نوقف فتح الصندوق إذا كان جدول inventory
     * يحتاج إلى ضبط منفصل.
     */

    return null;
  }
}

async function playNormalGame({
  user,
  game
}) {

  const cost =
    Number(GAME_COSTS[game] || 0);

  if (!cost) {
    throw new Error("اللعبة غير موجودة");
  }

  const balance =
    Number(user.balance || 0);

  if (balance < cost) {
    throw new Error(
      `رصيدك غير كافٍ. تكلفة اللعبة ${cost} 💰`
    );
  }

  let reward = 0;
  let message = "";

  switch (game) {

    case "dice": {

      const dice =
        crypto.randomInt(1, 7);

      if (dice === 6) {
        reward = 250;
      } else if (dice >= 4) {
        reward = 100;
      } else {
        reward = 0;
      }

      message =
        `🎲 ظهرت النتيجة ${dice}`;
      break;
    }

    case "coin": {

      const win =
        crypto.randomInt(0, 2) === 1;

      reward =
        win ? 100 : 0;

      message =
        win
          ? "🪙 فزت في رمية العملة!"
          : "🪙 لم يحالفك الحظ.";
      break;
    }

    case "quickbox": {

      const rewards = [
        50,
        100,
        150,
        250,
        500,
        1000
      ];

      reward = randomItem(rewards);

      message =
        "📦 حصلت على جائزة الصندوق السريع!";
      break;
    }

    case "slots": {

      const win =
        crypto.randomInt(1, 101) <= 35;

      reward =
        win
          ? randomItem([150, 250, 400, 750])
          : 0;

      message =
        win
          ? "🎰 فزت في آلة الحظ!"
          : "🎰 لم تفز هذه المرة.";
      break;
    }

    case "wheel": {

      const rewards = [
        0,
        50,
        100,
        250,
        500,
        1000,
        2500
      ];

      reward =
        randomItem(rewards);

      message =
        "🎡 دارت عجلة الحظ!";
      break;
    }

    case "cards": {

      const win =
        crypto.randomInt(1, 101) <= 40;

      reward =
        win
          ? randomItem([300, 500, 750, 1200])
          : 0;

      message =
        win
          ? "🃏 اخترت البطاقة الرابحة!"
          : "🃏 البطاقة لم تكن رابحة.";
      break;
    }

    case "treasure": {

      const rewards = [
        0,
        100,
        250,
        500,
        1000,
        2000
      ];

      reward =
        randomItem(rewards);

      message =
        "💎 فتحت الكنز المخفي!";
      break;
    }

    case "boss": {

      const win =
        crypto.randomInt(1, 101) <= 45;

      reward =
        win
          ? randomItem([
              500,
              1000,
              2000,
              5000
            ])
          : 0;

      message =
        win
          ? "🐉 هزمت التنين!"
          : "🐉 التنين هزمك!";
      break;
    }

    default:
      throw new Error("اللعبة غير مدعومة");
  }

  const newBalance =
    balance - cost + reward;

  const updatedUser =
    await updateBalance(
      user.id,
      newBalance
    );

  await addTransaction({
    userId: user.id,
    username: user.username,
    type: "game",
    amount: reward - cost,
    description:
      `${game}: تكلفة ${cost}، جائزة ${reward}`
  });

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      balance: Number(updatedUser.balance || 0)
    },
    reward,
    cost,
    message
  };
}

async function openBox({
  user,
  boxId
}) {

  const box =
    BOXES[boxId];

  if (!box) {
    throw new Error("الصندوق غير موجود");
  }

  const balance =
    Number(user.balance || 0);

  if (balance < box.price) {
    throw new Error(
      `رصيدك غير كافٍ. سعر الصندوق ${box.price} 💰`
    );
  }

  const reward =
    randomItem(box.rewards);

  let newBalance =
    balance - box.price;

  /*
   * إذا كانت الجائزة مالية تضاف مباشرة.
   */

  if (reward.balance) {
    newBalance +=
      Number(reward.balance);
  }

  const updatedUser =
    await updateBalance(
      user.id,
      newBalance
    );

  /*
   * إذا كانت الجائزة عنصرًا، نحاول حفظها
   * داخل جدول inventory.
   */

  if (reward.item) {

    const productId =
      `box_${boxId}_${reward.name
        .replace(/\s+/g, "_")
        .slice(0, 30)}`;

    await addInventoryItem({
      userId: user.id,
      username: user.username,
      productId,
      productName: reward.name,
      icon: reward.icon
    });
  }

  await addTransaction({
    userId: user.id,
    username: user.username,
    type: "box",
    amount:
      reward.balance
        ? Number(reward.balance) - box.price
        : -box.price,
    description:
      `فتح ${boxId} وحصل على ${reward.name}`
  });

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      balance: Number(updatedUser.balance || 0)
    },

    reward: {
      icon: reward.icon,
      name: reward.name
    },

    message:
      `🎉 حصلت على ${reward.name}`
  };
}

async function transferMoney({
  user,
  toUsername,
  amount
}) {

  const targetName =
    cleanUsername(toUsername);

  const transferAmount =
    Number(amount);

  if (!targetName) {
    throw new Error("اكتب اسم المستلم");
  }

  if (
    !Number.isFinite(transferAmount) ||
    transferAmount <= 0
  ) {
    throw new Error("المبلغ غير صحيح");
  }

  if (
    targetName.toLowerCase() ===
    String(user.username).toLowerCase()
  ) {
    throw new Error(
      "لا يمكنك التحويل إلى نفسك"
    );
  }

  const senderBalance =
    Number(user.balance || 0);

  if (senderBalance < transferAmount) {
    throw new Error("رصيدك غير كافٍ");
  }

  const targets =
    await supabase(
      `/rest/v1/users?username=eq.${encodeURIComponent(
        targetName
      )}&select=id,username,balance`
    );

  if (
    !Array.isArray(targets) ||
    !targets.length
  ) {
    throw new Error(
      "المستخدم المستلم غير موجود"
    );
  }

  const target =
    targets[0];

  const targetBalance =
    Number(target.balance || 0);

  const sender =
    await updateBalance(
      user.id,
      senderBalance - transferAmount
    );

  await updateBalance(
    target.id,
    targetBalance + transferAmount
  );

  await addTransaction({
    userId: user.id,
    username: user.username,
    type: "transfer",
    amount: -transferAmount,
    description:
      `تحويل إلى ${target.username}`
  });

  await addTransaction({
    userId: target.id,
    username: target.username,
    type: "transfer",
    amount: transferAmount,
    description:
      `تحويل من ${user.username}`
  });

  return {
    user: {
      id: sender.id,
      username: sender.username,
      balance: Number(sender.balance || 0)
    },

    message:
      `✅ تم تحويل ${transferAmount.toLocaleString(
        "ar-EG"
      )} 💰 إلى ${target.username}`
  };
}

async function walletAction({
  user,
  action,
  amount
}) {

  const value =
    Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error("المبلغ غير صحيح");
  }

  const balance =
    Number(user.balance || 0);

  if (action === "withdraw") {

    if (balance < value) {
      throw new Error("رصيدك غير كافٍ");
    }

    const updated =
      await updateBalance(
        user.id,
        balance - value
      );

    await addTransaction({
      userId: user.id,
      username: user.username,
      type: "withdraw",
      amount: -value,
      description: "سحب من المحفظة"
    });

    return {
      user: {
        id: updated.id,
        username: updated.username,
        balance: Number(updated.balance || 0)
      },
      message:
        `✅ تم سحب ${value.toLocaleString(
          "ar-EG"
        )} 💰`
    };
  }

  if (action === "deposit") {

    const updated =
      await updateBalance(
        user.id,
        balance + value
      );

    await addTransaction({
      userId: user.id,
      username: user.username,
      type: "deposit",
      amount: value,
      description: "إيداع في المحفظة"
    });

    return {
      user: {
        id: updated.id,
        username: updated.username,
        balance: Number(updated.balance || 0)
      },
      message:
        `✅ تم إيداع ${value.toLocaleString(
          "ar-EG"
        )} 💰`
    };
  }

  throw new Error("عملية المحفظة غير صحيحة");
}

async function cityUpgrade({
  user
}) {

  const cost = 500;

  const balance =
    Number(user.balance || 0);

  if (balance < cost) {
    throw new Error(
      `تحتاج إلى ${cost} 💰 لتطوير المدينة`
    );
  }

  /*
   * جدول users عندك يحتوي على balance،
   * لكن قد لا يحتوي city.
   * لذلك نحاول تحديث city، وإذا لم يكن موجودًا
   * نكتفي بتحديث الرصيد.
   */

  let updatedUser;

  try {

    const result =
      await supabase(
        `/rest/v1/users?id=eq.${encodeURIComponent(
          String(user.id)
        )}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            balance: balance - cost,
            city: Number(user.city || 1) + 1
          })
        }
      );

    updatedUser =
      result?.[0];

  } catch {

    updatedUser =
      await updateBalance(
        user.id,
        balance - cost
      );
  }

  await addTransaction({
    userId: user.id,
    username: user.username,
    type: "city",
    amount: -cost,
    description: "تطوير المدينة"
  });

  return {
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      balance: Number(updatedUser.balance || 0),
      city: Number(updatedUser.city || user.city || 1) + (
        updatedUser.city ? 0 : 0
      )
    },

    message:
      "🏯 تم تطوير المدينة بنجاح."
  };
}

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return json(
      res,
      405,
      {
        success: false,
        message: "Method Not Allowed"
      }
    );
  }

  try {

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {

      return json(
        res,
        500,
        {
          success: false,
          message:
            "إعدادات Supabase غير موجودة في Vercel"
        }
      );
    }

    const body =
      req.body || {};

    const {
      userId,
      username,
      game,
      boxId,
      toUsername,
      amount
    } = body;

    /*
     * مهم:
     * لا نعتمد على الرصيد المرسل من المتصفح.
     * نقرأ الرصيد الحقيقي من Supabase.
     */

    const user =
      await findUser(
        userId,
        username
      );

    if (!user) {

      return json(
        res,
        401,
        {
          success: false,
          message:
            "المستخدم غير موجود أو انتهت الجلسة"
        }
      );
    }

    let result;

    if (game === "box") {

      result =
        await openBox({
          user,
          boxId
        });

    } else if (game === "transfer") {

      result =
        await transferMoney({
          user,
          toUsername,
          amount
        });

    } else if (
      game === "deposit" ||
      game === "withdraw"
    ) {

      result =
        await walletAction({
          user,
          action: game,
          amount
        });

    } else if (game === "city_upgrade") {

      result =
        await cityUpgrade({
          user
        });

    } else {

      result =
        await playNormalGame({
          user,
          game
        });
    }

    return json(
      res,
      200,
      {
        success: true,
        ...result
      }
    );

  } catch (error) {

    console.error(
      "GAME API ERROR:",
      error
    );

    return json(
      res,
      error.status >= 400 && error.status < 500
        ? error.status
        : 500,
      {
        success: false,
        message:
          error.message ||
          "حدث خطأ في الخادم"
      }
    );
  }
}
