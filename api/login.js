// api/login.js

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



    const cleanUsername =
    username.trim().toLowerCase();



    const {data:user,error}=await supabase
    .from("users")
    .select("*")
    .ilike("username",cleanUsername)
    .single();



    if(error || !user){

      console.log("USER ERROR:",error);

      return res.json({

        success:false,

        message:"الحساب غير موجود"

      });

    }



    if(user.banned === true){

      return res.json({

        success:false,

        message:
        "🚫 الحساب محظور: "+
        (user.ban_reason || "")

      });

    }




    const passHash =
    hashPassword(password);



    if(passHash !== user.password_hash){

      return res.json({

        success:false,

        message:"كلمة المرور خاطئة"

      });

    }




    // جعل حساب admin أو Nero مدير

    let isAdmin = false;


    if(
      user.username.toLowerCase()==="admin" ||
      user.username.toLowerCase()==="nero"
    ){

      isAdmin=true;


      await supabase
      .from("users")
      .update({

        role:"admin"

      })
      .eq("id",user.id);


      user.role="admin";

    }




    return res.json({

      success:true,


      user:{


        id:user.id,


        username:user.username,


        balance:
        user.balance || 0,


        role:
        user.role || "user",


        isAdmin:isAdmin,


        banned:
        user.banned || false


      }


    });




  }catch(error){


    console.log(error);


    return res.json({

      success:false,

      message:error.message

    });


  }


}
