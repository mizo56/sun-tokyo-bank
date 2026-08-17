// api/register.js

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);



function hashPassword(password){

  return crypto
  .createHash("sha256")
  .update(password)
  .digest("hex");

}



export default async function handler(req,res){


  if(req.method !== "POST"){

    return res.status(405).json({

      success:false,
      message:"Method not allowed"

    });

  }



  try{


    const {
      username,
      password
    } = req.body;



    if(!username || !password){

      return res.json({

        success:false,
        message:"أدخل اسم المستخدم وكلمة المرور"

      });

    }



    // فحص الاسم موجود
    const {data:oldUser}=await supabase
    .from("users")
    .select("id")
    .eq("username",username)
    .single();



    if(oldUser){

      return res.json({

        success:false,
        message:"اسم المستخدم مستخدم مسبقاً"

      });

    }





    // حساب Nero يصبح أدمن
    let role="user";
    let balance=0;
    let isAdmin=false;



    if(username.toLowerCase()==="nero"){

      role="admin";
      isAdmin=true;

      // رصيد الأدمن
      balance=999999999999999;

    }





    const {data,error}=await supabase
    .from("users")
    .insert([{

      username,

      password_hash:
      hashPassword(password),

      balance,

      role,

      isAdmin,

      banned:false

    }])
    .select()
    .single();




    if(error){

      throw error;

    }




    return res.json({

      success:true,

      message:"تم إنشاء الحساب",

      user:{

        username:data.username,

        balance:data.balance,

        role:data.role,

        isAdmin:data.isAdmin

      }

    });





  }catch(error){


    return res.json({

      success:false,

      message:error.message

    });


  }


}
