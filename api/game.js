import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

async function supabaseFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
}


/* =====================================================
   الصناديق
===================================================== */

const BOXES = {

  box1: {
    name: "📦 صندوق المبتدئ",
    price: 100,
    style: "wood",

    rewards: [
      {
        name: "💰 50 عملة",
        type: "money",
        value: 50,
        chance: 35
      },
      {
        name: "💰 100 عملة",
        type: "money",
        value: 100,
        chance: 30
      },
      {
        name: "🧪 جرعة صحة",
        type: "item",
        value: 1,
        chance: 20
      },
      {
        name: "⚔️ سيف حديدي",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "💎 جوهرة صغيرة",
        type: "item",
        value: 1,
        chance: 5
      }
    ]
  },


  box2: {
    name: "🐉 صندوق التنين",
    price: 250,
    style: "dragon",

    rewards: [
      {
        name: "💰 150 عملة",
        type: "money",
        value: 150,
        chance: 30
      },
      {
        name: "💰 300 عملة",
        type: "money",
        value: 300,
        chance: 25
      },
      {
        name: "🗡️ خنجر التنين",
        type: "item",
        value: 1,
        chance: 20
      },
      {
        name: "🛡️ درع التنين",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "🔥 حجر اللهب",
        type: "item",
        value: 1,
        chance: 7
      },
      {
        name: "💎 جوهرة التنين",
        type: "item",
        value: 1,
        chance: 3
      }
    ]
  },


  box3: {
    name: "⚔️ صندوق المحارب",
    price: 500,
    style: "warrior",

    rewards: [
      {
        name: "💰 300 عملة",
        type: "money",
        value: 300,
        chance: 25
      },
      {
        name: "💰 700 عملة",
        type: "money",
        value: 700,
        chance: 20
      },
      {
        name: "⚔️ سيف المحارب",
        type: "item",
        value: 1,
        chance: 20
      },
      {
        name: "🛡️ درع أسطوري",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "❤️ جرعة أسطورية",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "💎 جوهرة حمراء",
        type: "item",
        value: 1,
        chance: 7
      },
      {
        name: "👑 تاج المحارب",
        type: "item",
        value: 1,
        chance: 3
      }
    ]
  },


  box4: {
    name: "🔮 صندوق النينجا",
    price: 1000,
    style: "ninja",

    rewards: [
      {
        name: "💰 500 عملة",
        type: "money",
        value: 500,
        chance: 25
      },
      {
        name: "💰 1200 عملة",
        type: "money",
        value: 1200,
        chance: 20
      },
      {
        name: "🥷 قناع النينجا",
        type: "item",
        value: 1,
        chance: 18
      },
      {
        name: "🗡️ كاتانا سوداء",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "🌑 حجر الظلام",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "💎 جوهرة الظلام",
        type: "item",
        value: 1,
        chance: 8
      },
      {
        name: "👑 خوذة النينجا الملكية",
        type: "item",
        value: 1,
        chance: 4
      }
    ]
  },


  box5: {
    name: "🏯 صندوق الإمبراطور",
    price: 2500,
    style: "emperor",

    rewards: [
      {
        name: "💰 1000 عملة",
        type: "money",
        value: 1000,
        chance: 25
      },
      {
        name: "💰 3000 عملة",
        type: "money",
        value: 3000,
        chance: 20
      },
      {
        name: "⚔️ سيف الإمبراطور",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "🛡️ درع الإمبراطور",
        type: "item",
        value: 1,
        chance: 12
      },
      {
        name: "👘 رداء الإمبراطور",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "💎 جوهرة ملكية",
        type: "item",
        value: 1,
        chance: 8
      },
      {
        name: "👑 تاج الإمبراطور",
        type: "item",
        value: 1,
        chance: 6
      },
      {
        name: "🐉 روح التنين",
        type: "item",
        value: 1,
        chance: 4
      }
    ]
  },


  box6: {
    name: "💎 صندوق الأسطورة",
    price: 5000,
    style: "legend",

    rewards: [
      {
        name: "💰 2500 عملة",
        type: "money",
        value: 2500,
        chance: 22
      },
      {
        name: "💰 7000 عملة",
        type: "money",
        value: 7000,
        chance: 18
      },
      {
        name: "⚔️ سيف أسطوري",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "🛡️ درع أسطوري",
        type: "item",
        value: 1,
        chance: 12
      },
      {
        name: "💎 جوهرة أسطورية",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "🔥 قلب التنين",
        type: "item",
        value: 1,
        chance: 8
      },
      {
        name: "🌌 حجر المجرة",
        type: "item",
        value: 1,
        chance: 8
      },
      {
        name: "👑 تاج الأسطورة",
        type: "item",
        value: 1,
        chance: 5
      },
      {
        name: "🐉 تنين أسطوري",
        type: "item",
        value: 1,
        chance: 2
      }
    ]
  },


  box7: {
    name: "👑 صندوق S.U.N TOKYO",
    price: 10000,
    style: "sun",

    rewards: [
      {
        name: "💰 5000 عملة",
        type: "money",
        value: 5000,
        chance: 20
      },
      {
        name: "💰 15000 عملة",
        type: "money",
        value: 15000,
        chance: 15
      },
      {
        name: "⚔️ سيف S.U.N TOKYO",
        type: "item",
        value: 1,
        chance: 15
      },
      {
        name: "🛡️ درع S.U.N TOKYO",
        type: "item",
        value: 1,
        chance: 12
      },
      {
        name: "👑 تاج S.U.N TOKYO",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "🔥 قلب التنين الملكي",
        type: "item",
        value: 1,
        chance: 10
      },
      {
        name: "💎 جوهرة الشمس",
        type: "item",
        value: 1,
        chance: 8
      },
      {
        name: "🌌 حجر المجرة الملكي",
        type: "item",
        value: 1,
        chance: 6
      },
      {
        name: "🐉 تنين ملكي",
        type: "item",
        value: 1,
        chance: 3
      },
      {
        name: "👑🏯 عرش S.U.N TOKYO",
        type: "item",
        value: 1,
        chance: 1
      }
    ]
  }

};


/* =====================================================
   اختيار جائزة
===================================================== */

function chooseReward(rewards) {

  const total =
    rewards.reduce(
      (sum, reward) =>
        sum + reward.chance,
      0
    );

  let random =
    Math.random() * total;

  for (const reward of rewards) {

    random -= reward.chance;

    if (random <= 0) {
      return reward;
    }

  }

  return rewards[rewards.length - 1];
}


/* =====================================================
   التحقق من المستخدم
===================================================== */

async function getUser(username, password) {

  const passwordHash =
    hashPassword(password);

  const response =
    await supabaseFetch(
      `/rest/v1/users?username=eq.${encodeURIComponent(
        username
      )}&password_hash=eq.${encodeURIComponent(
        passwordHash
      )}&select=id,username,balance`
    );

  const text =
    await response.text();

  if (!response.ok) {

    console.error(
      "Supabase user error:",
      text
    );

    throw new Error(
      "تعذر الاتصال بقاعدة البيانات"
    );

  }

  let users;

  try {

    users =
      JSON.parse(text);

  } catch {

    throw new Error(
      "استجابة غير صحيحة من قاعدة البيانات"
    );

  }

  if (
    !Array.isArray(users) ||
    users.length === 0
  ) {

    return null;

  }

  return users[0];

}


/* =====================================================
   تحديث الرصيد
===================================================== */

async function updateBalance(
  userId,
  balance
) {

  const response =
    await supabaseFetch(
      `/rest/v1/users?id=eq.${encodeURIComponent(
        userId
      )}`,
      {
        method: "PATCH",

        body: JSON.stringify({
          balance
        })
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    console.error(
      "Balance update error:",
      text
    );

    throw new Error(
      "تعذر تحديث الرصيد"
    );

  }

}


/* =====================================================
   إضافة المنتج للمخزون
===================================================== */

async function addInventoryItem(
  userId,
  itemName,
  itemType = "item"
) {

  const checkResponse =
    await supabaseFetch(
      `/rest/v1/inventory?user_id=eq.${encodeURIComponent(
        userId
      )}&item_name=eq.${encodeURIComponent(
        itemName
      )}&select=id,quantity`
    );

  const checkText =
    await checkResponse.text();

  if (!checkResponse.ok) {

    console.error(
      "Inventory check error:",
      checkText
    );

    throw new Error(
      "تعذر فحص المخزون"
    );

  }

  let items = [];

  try {

    items =
      JSON.parse(checkText);

  } catch {

    items = [];

  }


  if (
    Array.isArray(items) &&
    items.length > 0
  ) {

    const item =
      items[0];

    const newQuantity =
      Number(item.quantity || 0) + 1;

    const updateResponse =
      await supabaseFetch(
        `/rest/v1/inventory?id=eq.${encodeURIComponent(
          item.id
        )}`,
        {
          method: "PATCH",

          body: JSON.stringify({
            quantity: newQuantity
          })
        }
      );

    const updateText =
      await updateResponse.text();

    if (!updateResponse.ok) {

      console.error(
        "Inventory update error:",
        updateText
      );

      throw new Error(
        "تعذر تحديث المخزون"
      );

    }

    return;

  }


  const insertResponse =
    await supabaseFetch(
      "/rest/v1/inventory",
      {
        method: "POST",

        body: JSON.stringify({
          user_id: userId,
          item_name: itemName,
          item_type: itemType,
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

    throw new Error(
      "تعذر إضافة الجائزة إلى المخزون"
    );

  }

}


/* =====================================================
   الألعاب
===================================================== */

async function playNormalGame(
  game,
  balance
) {

  const games = {

    dice: {
      name: "🎲 النرد",
      cost: 25
    },

    quickBox: {
      name: "📦 الصندوق السريع",
      cost: 50
    },

    miniGame: {
      name: "🎯 الهدف",
      cost: 75
    },

    lucky: {
      name: "🍀 الحظ",
      cost: 150
    },

    treasure: {
      name: "💰 الكنز",
      cost: 250
    }

  };

  const selected =
    games[game];

  if (!selected) {
    return null;
  }

  if (balance < selected.cost) {

    throw new Error(
      `رصيدك غير كافٍ. تحتاج ${selected.cost} 💰`
    );

  }

  let reward = 0;

  let value = 0;


  if (game === "dice") {

    value =
      Math.floor(
        Math.random() * 6
      ) + 1;

    if (value === 6) {
      reward = 150;
    } else if (value >= 4) {
      reward = 50;
    }

  }


  else if (game === "quickBox") {

    const rewards =
      [0, 25, 50, 100, 200];

    reward =
      rewards[
        Math.floor(
          Math.random() *
          rewards.length
        )
      ];

    value = reward;

  }


  else if (game === "miniGame") {

    value =
      Math.floor(
        Math.random() * 100
      ) + 1;

    reward =
      value >= 70
        ? 200
        : value >= 40
          ? 75
          : 0;

  }


  else if (game === "lucky") {

    const rewards =
      [0, 100, 250, 500];

    reward =
      rewards[
        Math.floor(
          Math.random() *
          rewards.length
        )
      ];

    value = reward;

  }


  else if (game === "treasure") {

    const rewards =
      [0, 100, 300, 750, 1500];

    reward =
      rewards[
        Math.floor(
          Math.random() *
          rewards.length
        )
      ];

    value = reward;

  }


  const newBalance =
    balance -
    selected.cost +
    reward;


  return {
    game,
    name: selected.name,
    cost: selected.cost,
    reward,
    value,
    balance: newBalance
  };

}


/* =====================================================
   HANDLER
===================================================== */

export default async function handler(
  req,
  res
) {

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


    const {
      username,
      password,
      game,
      box
    } = req.body || {};


    if (
      !username ||
      !password
    ) {

      return res.status(400).json({
        success: false,
        message:
          "اسم المستخدم وكلمة المرور مطلوبان"
      });

    }


    const cleanUsername =
      String(username).trim();


    const cleanPassword =
      String(password);


    const user =
      await getUser(
        cleanUsername,
        cleanPassword
      );


    if (!user) {

      return res.status(401).json({
        success: false,
        message:
          "اسم المستخدم أو كلمة المرور غير صحيحة"
      });

    }


    const currentBalance =
      Number(user.balance || 0);


    /* ==========================================
       المكافأة اليومية
    ========================================== */

    if (game === "daily") {

      const reward = 500;

      const newBalance =
        currentBalance + reward;

      await updateBalance(
        user.id,
        newBalance
      );

      return res.status(200).json({

        success: true,

        type: "daily",

        message:
          "🎁 حصلت على المكافأة اليومية!",

        reward,

        balance: newBalance

      });

    }


    /* ==========================================
       فتح صندوق
    ========================================== */

    if (box) {

      const selectedBox =
        BOXES[box];


      if (!selectedBox) {

        return res.status(400).json({
          success: false,
          message:
            "❌ الصندوق غير موجود"
        });

      }


      const price =
        Number(
          selectedBox.price
        );


      if (
        currentBalance <
        price
      ) {

        return res.status(400).json({

          success: false,

          message:
            `❌ رصيدك غير كافٍ لفتح ${selectedBox.name}`,

          balance:
            currentBalance,

          price

        });

      }


      const reward =
        chooseReward(
          selectedBox.rewards
        );


      let newBalance =
        currentBalance -
        price;


      if (
        reward.type ===
        "money"
      ) {

        newBalance +=
          Number(
            reward.value || 0
          );

      }


      await updateBalance(
        user.id,
        newBalance
      );


      if (
        reward.type ===
        "item"
      ) {

        await addInventoryItem(
          user.id,
          reward.name,
          "box_reward"
        );

      }


      return res.status(200).json({

        success: true,

        type: "box",

        box: box,

        boxName:
          selectedBox.name,

        boxStyle:
          selectedBox.style,

        price,

        reward: reward.name,

        rewardType:
          reward.type,

        rewardValue:
          reward.value,

        balance:
          newBalance,

        explosion: true

      });

    }


    /* ==========================================
       الألعاب العادية
    ========================================== */

    if (game) {

      const result =
        await playNormalGame(
          game,
          currentBalance
        );


      if (!result) {

        return res.status(400).json({
          success: false,
          message:
            "❌ اللعبة غير موجودة"
        });

      }


      await updateBalance(
        user.id,
        result.balance
      );


      return res.status(200).json({

        success: true,

        type: "game",

        game:
          result.game,

        gameName:
          result.name,

        cost:
          result.cost,

        reward:
          result.reward,

        value:
          result.value,

        balance:
          result.balance

      });

    }


    return res.status(400).json({

      success: false,

      message:
        "لم يتم تحديد لعبة أو صندوق"

    });


  } catch (error) {

    console.error(
      "Game API error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "حدث خطأ في الخادم"

    });

  }

}
