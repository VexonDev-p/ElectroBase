export const runtime = "nodejs";

export default async function handler(request) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            10000
        );

    try {

        const url =
            `${process.env.supabase_url}/rest/v1/settings?select=id&limit=1`;

        const result =
            await fetch(
                url,
                {
                    method: "GET",

                    headers: {
                        "apikey":
                            process.env.supabase_secret_key,

                        "Content-Type":
                            "application/json"
                    },

                    signal:
                        controller.signal
                }
            );

        const text =
            await result.text();

        return new Response(
            JSON.stringify({
                ok: result.ok,
                status: result.status,
                response: text
            }),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } catch(error) {

        return new Response(
            JSON.stringify({
                ok: false,
                error:
                    error.name === "AbortError"
                    ? "SUPABASE_TIMEOUT"
                    : error.message
            }),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } finally {

        clearTimeout(timeout);

    }

}
