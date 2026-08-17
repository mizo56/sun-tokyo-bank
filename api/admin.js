// api/admin.js

import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);



export default async function handler(req,res){


  if(req.method !== "POST"){

    return res.status(405).json({

      success:false,
      message:"Method not allowed"

    });

  }



  try{


    const {
      action,
      userId,
      amount,
      role,
      ban_reason
    } = req.body;



    if(action === "users"){


      const {data,error}=await supabase

      .from("users")

      .select("*")

      .order("id",{ascending:false});



      if(error) throw error;



      return res.json({

        success:true,

        users:data

      });


    }



    if(action === "add_balance"){


      const {data:user}=await supabase

      .from("users")

      .select("balance")

      .eq("id",userId)

      .single();



      await supabase

      .from("users")

      .update({

        balance:
        Number(user.balance || 0)
        +
        Number(amount)

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم إضافة الرصيد"

      });


    }



    if(action === "remove_balance"){


      const {data:user}=await supabase

      .from("users")

      .select("balance")

      .eq("id",userId)

      .single();



      await supabase

      .from("users")

      .update({

        balance:
        Math.max(
          0,
          Number(user.balance || 0)
          -
          Number(amount)
        )

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم خصم الرصيد"

      });


    }



    if(action === "set_role"){


      await supabase

      .from("users")

      .update({

        role:role || "admin"

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم تغيير الرتبة"

      });


    }



    if(action === "ban_user"){


      await supabase

      .from("users")

      .update({

        banned:true,

        ban_reason:ban_reason || "مخالفة"

      })

      .eq("id",userId);



      return res.json({

        success:true,

        message:"تم الحظر"

      });


    }



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

      message:"أمر غير معروف"

    });



  }catch(error){


    console.log("ADMIN ERROR:",error);



    return res.json({

      success:false,

      message:error.message

    });


  }


}
