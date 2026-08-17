// api/admin.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);


// حساب الأدمن الرئيسي
const ADMIN_USERNAME = "Nero";
const ADMIN_PASSWORD = "92264989226498";


export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success:false,
      message:"Method not allowed"
    });
  }


  try {

    const {
      action,
      username,
      password,
      userId,
      amount,
      role
    } = req.body;



    // تسجيل دخول الأدمن
    if(action === "admin_login"){

      if(
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
      ){

        return res.json({

          success:true,

          admin:{
            username:ADMIN_USERNAME,
            isAdmin:true,
            balance:"∞"
          }

        });

      }


      return res.json({

        success:false,

        message:"بيانات الأدمن غير صحيحة"

      });

    }




    // التحقق من صلاحية الأدمن
    if(action !== "admin_login"){

      if(
        username !== ADMIN_USERNAME
      ){

        return res.json({

          success:false,

          message:"لا توجد صلاحية"

        });

      }

    }




    // جلب جميع المستخدمين
    if(action==="users"){


      const {data,error}=await supabase
      .from("users")
      .select("*")
      .order("created_at",{ascending:false});


      if(error) throw error;


      return res.json({

        success:true,

        users:data

      });

    }





    // إضافة رصيد
    if(action==="add_balance"){


      const {data:user}=await supabase
      .from("users")
      .select("balance")
      .eq("id",userId)
      .single();


      await supabase
      .from("users")
      .update({

        balance:
        Number(user.balance||0)
        +
        Number(amount)

      })
      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم إضافة الرصيد"

      });

    }






    // حذف عضو
    if(action==="delete_user"){


      await supabase
      .from("users")
      .delete()
      .eq("id",userId);


      return res.json({

        success:true,

        message:"تم حذف المستخدم"

      });

    }







    // تغيير الصلاحية
    if(action==="set_role"){


      await supabase
      .from("users")
      .update({

        role:role || "admin"

      })
      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم تغيير الصلاحية"

      });

    }






    // حظر عضو
    if(action==="ban_user"){


      await supabase
      .from("users")
      .update({

        banned:true,

        ban_reason:req.body.ban_reason || "مخالفة"

      })
      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم حظر المستخدم"

      });


    }





    // فك الحظر
    if(action==="unban_user"){


      await supabase
      .from("users")
      .update({

        banned:false,

        ban_reason:null

      })
      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم فك الحظر"

      });

    }




    return res.json({

      success:false,

      message:"أمر غير معروف"

    });



  } catch(error){


    return res.status(500).json({

      success:false,

      message:error.message

    });


  }


}
