// api/admin.js

import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!supabaseUrl || !supabaseKey) {

  console.log("Missing Supabase Environment Variables");

}


const supabase = createClient(
  supabaseUrl,
  supabaseKey
);



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
      userId,
      amount,
      role,
      ban_reason
    } = req.body;



    // جلب المستخدمين

    if(action === "users"){


      const {data, error} = await supabase

      .from("users")

      .select("*")

      .order("id",{ascending:false});



      if(error) throw error;



      return res.json({

        success:true,

        users:data

      });


    }





    // إضافة رصيد

    if(action === "add_balance"){


      const {data:user,error} = await supabase

      .from("users")

      .select("balance")

      .eq("id",userId)

      .single();



      if(error) throw error;



      await supabase

      .from("users")

      .update({

        balance:
        Number(user.balance || 0)
        +
        Number(amount || 0)

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم إضافة الرصيد"

      });


    }





    // خصم رصيد

    if(action === "remove_balance"){


      const {data:user,error} = await supabase

      .from("users")

      .select("balance")

      .eq("id",userId)

      .single();



      if(error) throw error;



      await supabase

      .from("users")

      .update({

        balance:
        Math.max(
          0,
          Number(user.balance || 0)
          -
          Number(amount || 0)
        )

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم خصم الرصيد"

      });


    }





    // جعل أدمن

    if(action === "set_role"){


      await supabase

      .from("users")

      .update({

        role: role || "admin"

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم تغيير الصلاحية"

      });


    }





    // حظر

    if(action === "ban_user"){


      await supabase

      .from("users")

      .update({

        banned:true,

        ban_reason:
        ban_reason || "مخالفة القوانين"

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم الحظر"

      });


    }





    // فك الحظر

    if(action === "unban_user"){


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





    // حذف

    if(action === "delete_user"){


      await supabase

      .from("users")

      .delete()

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم حذف الحساب"

      });


    }





    return res.json({

      success:false,

      message:"الأمر غير موجود"

    });



  } catch(error) {


    console.log("ADMIN ERROR:",error);



    return res.status(500).json({

      success:false,

      message:error.message

    });


  }


}
