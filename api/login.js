// api/login.js

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY
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



    const cleanUsername = username.trim();



    const { data:user, error } = await supabase

      .from("users")

      .select("*")

      .ilike("username", cleanUsername)

      .single();



    console.log(
      "LOGIN:",
      cleanUsername,
      user,
      error
    );



    if(error || !user){

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



    const passHash = hashPassword(password);



    if(passHash !== user.password_hash){

      return res.json({

        success:false,

        message:"كلمة المرور خاطئة"

      });

    }



    // حساب Nero أو admin يصبح أدمن

    let isAdmin = false;


    if(
      user.username.toLowerCase() === "nero" ||
      user.username.toLowerCase() === "admin"
    ){

      isAdmin = true;


      await supabase

      .from("users")

      .update({

        role:"admin"

      })

      .eq("id",user.id);


    }



    return res.json({

      success:true,

      user:{

        id:user.id,

        username:user.username,

        balance:
        isAdmin
        ? 999999999999999
        : Number(user.balance || 0),


        role:
        isAdmin
        ? "admin"
        : (user.role || "user"),


        isAdmin,


        banned:false

      }

    });



  }catch(error){


    console.log(error);


    return res.status(500).json({

      success:false,

      message:error.message

    });


  }


}
