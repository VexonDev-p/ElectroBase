export const runtime = "nodejs";

export default function handler(
    request,
    response
){

    response.status(200).json({

        ok:true,

        action:
            request.query?.action ||
            null,

        variables:{
            supabase_url:
                Boolean(
                    process.env.supabase_url
                ),

            supabase_secret_key:
                Boolean(
                    process.env.supabase_secret_key
                ),

            admin_login:
                Boolean(
                    process.env.admin_login
                ),

            admin_password:
                Boolean(
                    process.env.admin_password
                )
        }

    });

}
