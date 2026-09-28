export default async function handler(request) {

    const url =
        new URL(request.url);

    return new Response(
        JSON.stringify({
            ok: true,

            action:
                url.searchParams.get("action"),

            variables: {
                supabase_url:
                    Boolean(process.env.supabase_url),

                supabase_secret_key:
                    Boolean(process.env.supabase_secret_key),

                admin_login:
                    Boolean(process.env.admin_login),

                admin_password:
                    Boolean(process.env.admin_password)
            }
        }),
        {
            status: 200,

            headers: {
                "Content-Type":
                    "application/json"
            }
        }
    );

}
