import crypto from "node:crypto";

/*
=========================================================
ELECTROBASE API
=========================================================

Этот файл отвечает за:
- пользователей
- временные аккаунты
- авторизацию
- онлайн
- посещения
- технические работы
- настройки сайта
- админ-панель
- журнал событий

Секреты НЕ хранятся здесь.
Они будут добавлены в Vercel Environment Variables.
=========================================================
*/


const SUPABASE_URL = process.env.supabase_url;

const SUPABASE_SECRET_KEY = process.env.supabase_secret_key;

const ADMIN_LOGIN = process.env.admin_login;

const ADMIN_PASSWORD = process.env.admin_password;


const USER_SESSION_TIME =
    1000 * 60 * 60 * 24;

const ONLINE_TIME =
    1000 * 60 * 2;


/* =========================================================
   RESPONSE
========================================================= */

function response(
    status,
    data
){

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers:{
                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-store",

                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Headers":
                    "Content-Type"
            }
        }
    );

}


/* =========================================================
   SUPABASE REQUEST
========================================================= */

async function db(
    table,
    options = {}
){

    if(
        !SUPABASE_URL ||
        !SUPABASE_SECRET_KEY
    ){

        throw new Error(
            "Supabase ещё не подключён."
        );

    }


    const baseUrl =
        String(SUPABASE_URL)
            .replace(/\/+$/, "");


    const url =
        `${baseUrl}/rest/v1/${table}`;


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => controller.abort(),
            10000
        );


    try{

        const result =
            await fetch(
                url,
                {
                    ...options,

                    signal:
                        controller.signal,

                    headers:{
                        "apikey":
                            SUPABASE_SECRET_KEY,

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        ...(options.headers || {})
                    }
                }
            );


        const text =
            await result.text();


        let data = null;


        if(text){

            try{

                data =
                    JSON.parse(text);

            }catch{

                data =
                    text;

            }

        }


        if(!result.ok){

            console.error(
                "SUPABASE ERROR:",
                {
                    status:
                        result.status,

                    statusText:
                        result.statusText,

                    data
                }
            );


            throw new Error(
                data?.message ||
                data?.hint ||
                `Supabase HTTP ${result.status}`
            );

        }


        return {
            data,
            result
        };


    }catch(error){

        if(
            error?.name ===
            "AbortError"
        ){

            console.error(
                "SUPABASE TIMEOUT:",
                url
            );


            throw new Error(
                "Supabase не отвечает более 10 секунд."
            );

        }


        console.error(
            "SUPABASE REQUEST ERROR:",
            error
        );


        throw error;

    }finally{

        clearTimeout(
            timeout
        );

    }

}

/* =========================================================
   HELPERS
========================================================= */

function currentTime(){

    return new Date()
        .toISOString();

}


function randomToken(
    bytes = 32
){

    return crypto
        .randomBytes(bytes)
        .toString("hex");

}


function passwordHash(
    password
){

    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");


    const hash =
        crypto
            .scryptSync(
                password,
                salt,
                64
            )
            .toString("hex");


    return `${salt}:${hash}`;

}


function checkPassword(
    password,
    stored
){

    try{

        const parts =
            stored.split(":");


        if(parts.length !== 2){

            return false;

        }


        const salt =
            parts[0];

        const originalHash =
            parts[1];


        const hash =
            crypto
                .scryptSync(
                    password,
                    salt,
                    64
                )
                .toString("hex");


        return crypto.timingSafeEqual(
            Buffer.from(
                hash,
                "hex"
            ),

            Buffer.from(
                originalHash,
                "hex"
            )
        );

    }catch{

        return false;

    }

}


/* =========================================================
   ADMIN TOKEN
========================================================= */

function createAdminToken(){

    const timestamp =
        Date.now()
        .toString();


    const payload =
        Buffer
            .from(timestamp)
            .toString("base64url");


    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_PASSWORD
            )
            .update(timestamp)
            .digest("base64url");


    return `${payload}.${signature}`;

}


function verifyAdminToken(
    token
){

    try{

        if(!token){

            return false;

        }


        const parts =
            token.split(".");


        if(parts.length !== 2){

            return false;

        }


        const timestamp =
            Number(
                Buffer
                    .from(
                        parts[0],
                        "base64url"
                    )
                    .toString()
            );


        if(!Number.isFinite(timestamp)){

            return false;

        }


        /*
        Админская сессия действует 24 часа.
        */

        if(
            Date.now() -
            timestamp >
            USER_SESSION_TIME
        ){

            return false;

        }


        const expected =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_PASSWORD
                )
                .update(
                    timestamp.toString()
                )
                .digest("base64url");


        const receivedBuffer =
            Buffer.from(
                parts[1]
            );

        const expectedBuffer =
            Buffer.from(
                expected
            );


        if(
            receivedBuffer.length !==
            expectedBuffer.length
        ){

            return false;

        }


        return crypto.timingSafeEqual(
            receivedBuffer,
            expectedBuffer
        );

    }catch{

        return false;

    }

}


/* =========================================================
   LOGGING
========================================================= */

async function log(
    action,
    description
){

    try{

        await db(
            "logs",
            {
                method:"POST",

                headers:{
                    "Prefer":
                        "return=minimal"
                },

                body:JSON.stringify({

                    action,

                    description,

                    created_at:
                        currentTime()

                })
            }
        );

    }catch(error){

        console.error(
            "LOG ERROR:",
            error.message
        );

    }

}


/* =========================================================
   SETTINGS
========================================================= */

async function getSettings(){

    const result =
        await db(
            "settings?id=eq.1&select=*"
        );


    if(
        result.data &&
        result.data.length
    ){

        return result.data[0];

    }


    return {

        id:1,

        site_name:
            "ElectroBase",

        version:
            "2.0.0",

        mode:
            "online",

        message:
            "",

        code:
            "ONLINE"

    };

}


/* =========================================================
   PUBLIC DATA
========================================================= */

async function publicData(){

    const settings =
        await getSettings();


    return {

        config:{

            siteName:
                settings.site_name,

            version:
                settings.version,

            mode:
                settings.mode,

            message:
                settings.message,

            code:
                settings.code

        }

    };

}


/* =========================================================
   TRACK VISITOR
========================================================= */

async function trackVisitor(
    body
){

    const sessionId =
        String(
            body.sessionId || ""
        );


    if(!sessionId){

        return {
            ok:true
        };

    }


    const existing =
        await db(
            `sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=id,session_id`
        );


    const sessionExpires =
        new Date(
            Date.now() +
            USER_SESSION_TIME
        ).toISOString();


    if(
        existing.data &&
        existing.data.length
    ){

        await db(
            `sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
            {
                method:"PATCH",

                headers:{
                    "Prefer":
                        "return=minimal"
                },

                body:JSON.stringify({

                    last_seen:
                        currentTime(),

                    expires_at:
                        sessionExpires,

                    page:
                        body.page ||
                        "#home"

                })
            }
        );

    }else{

        await db(
            "sessions",
            {
                method:"POST",

                headers:{
                    "Prefer":
                        "return=minimal"
                },

                body:JSON.stringify({

                    session_id:
                        sessionId,

                    token:
                        randomToken(32),

                    page:
                        body.page ||
                        "#home",

                    last_seen:
                        currentTime(),

                    expires_at:
                        sessionExpires

                })
            }
        );


        /*
        Один новый session =
        одно новое посещение.
        */

        await db(
            "visits",
            {
                method:"POST",

                headers:{
                    "Prefer":
                        "return=minimal"
                },

                body:JSON.stringify({

                    session_id:
                        sessionId,

                    page:
                        body.page ||
                        "#home",

                    created_at:
                        currentTime()

                })
            }
        );

    }


    return {
        ok:true
    };

}


/* =========================================================
   USER LOGIN
========================================================= */

async function loginUser(
    body
){

    const username =
        String(
            body.username || ""
        )
        .trim();


    const password =
        String(
            body.password || ""
        );


    if(
        !username ||
        !password
    ){

        throw new Error(
            "Введите логин и пароль."
        );

    }


    const result =
        await db(
            `users?username=eq.${encodeURIComponent(username)}&select=id,username,password_hash,created_at,expires_at,last_login,is_blocked&limit=1`
        );


    const user =
        result.data?.[0];


    if(!user){

        throw new Error(
            "Неверный логин или пароль."
        );

    }


    if(user.is_blocked){

        throw new Error(
            "Этот аккаунт заблокирован."
        );

    }


    if(
        new Date(
            user.expires_at
        ) <= new Date()
    ){

        throw new Error(
            "Срок действия аккаунта истёк."
        );

    }


    if(
        !checkPassword(
            password,
            user.password_hash
        )
    ){

        throw new Error(
            "Неверный логин или пароль."
        );

    }


    const token =
        randomToken(48);


    await db(
        "sessions",
        {
            method:"POST",

            headers:{
                "Prefer":
                    "return=minimal"
            },

            body:JSON.stringify({

                session_id:
                    randomToken(12),

                token,

                user_id:
                    user.id,

                page:
                    "#profile",

                last_seen:
                    currentTime(),

                expires_at:
                    new Date(
                        Date.now() +
                        USER_SESSION_TIME
                    ).toISOString()

            })
        }
    );


    await db(
        `users?id=eq.${user.id}`,
        {
            method:"PATCH",

            headers:{
                "Prefer":
                    "return=minimal"
            },

            body:JSON.stringify({

                last_login:
                    currentTime()

            })
        }
    );


    await log(
        "USER_LOGIN",
        `Пользователь ${username} вошёл в систему.`
    );


    return {

        token,

        user:{

            id:
                user.id,

            username:
                user.username,

            created_at:
                user.created_at,

            expires_at:
                user.expires_at

        }

    };

}


/* =========================================================
   USER PROFILE
========================================================= */

async function getProfile(
    body
){

    const token =
        String(
            body.token || ""
        );


    if(!token){

        throw new Error(
            "Сессия отсутствует."
        );

    }


    const sessions =
        await db(
            `sessions?token=eq.${encodeURIComponent(token)}&select=user_id,expires_at&limit=1`
        );


    const session =
        sessions.data?.[0];


    if(!session){

        throw new Error(
            "Сессия недействительна."
        );

    }


    if(
        new Date(
            session.expires_at
        ) <= new Date()
    ){

        throw new Error(
            "Сессия истекла."
        );

    }


    if(!session.user_id){

        throw new Error(
            "Пользователь не найден."
        );

    }


    const users =
        await db(
            `users?id=eq.${session.user_id}&select=id,username,created_at,expires_at,is_blocked&limit=1`
        );


    const user =
        users.data?.[0];


    if(!user){

        throw new Error(
            "Пользователь не найден."
        );

    }


    if(user.is_blocked){

        throw new Error(
            "Аккаунт заблокирован."
        );

    }


    return {
        user
    };

}


/* =========================================================
   COUNT ROWS
========================================================= */

async function countRows(
    table,
    query=""
){

    const result =
        await db(
            `${table}?select=id${query ? "&"+query : ""}`,
            {
                method:"HEAD",

                headers:{
                    "Prefer":
                        "count=exact"
                }
            }
        );


    const range =
        result.result
            .headers
            .get(
                "content-range"
            );


    if(!range){

        return 0;

    }


    const parts =
        range.split("/");


    return Number(
        parts[1]
    ) || 0;

}


/* =========================================================
   ADMIN STATISTICS
========================================================= */

async function adminStats(){

    const config =
        await getSettings();


    /*
    Пользователь считается онлайн,
    если последний запрос был
    не более 2 минут назад.
    */

    const onlineFrom =
        new Date(
            Date.now() -
            ONLINE_TIME
        )
        .toISOString();


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const online =
        await countRows(
            "sessions",
            `last_seen=gte.${encodeURIComponent(onlineFrom)}`
        );


    const visits =
        await countRows(
            "visits"
        );


    const todayVisits =
        await countRows(
            "visits",
            `created_at=gte.${encodeURIComponent(today.toISOString())}`
        );


    const users =
        await countRows(
            "users"
        );


    const usersList =
        await db(
            "users?select=id,username,created_at,expires_at,last_login,is_blocked&order=created_at.desc&limit=100"
        );


    const logs =
        await db(
            "logs?select=id,action,description,created_at&order=created_at.desc&limit=100"
        );


    return {

        stats:{

            online,

            visits,

            today:
                todayVisits,

            users

        },

        config,

        users:
            usersList.data || [],

        logs:
            logs.data || []

    };

}


/* =========================================================
   CREATE TEMP USER
========================================================= */

async function createUser(
    body
){

    let username =
        String(
            body.username || ""
        )
        .trim();


    let password =
        String(
            body.password || ""
        );


    const hours =
        Math.max(
            1,

            Math.min(
                8760,
                Number(
                    body.hours
                ) || 24
            )
        );


    if(
        username.length < 3
    ){

        throw new Error(
            "Логин должен содержать минимум 3 символа."
        );

    }


    if(!password){

        password =
            randomToken(6);

    }


    if(
        password.length < 4
    ){

        throw new Error(
            "Пароль должен содержать минимум 4 символа."
        );

    }


    const existing =
        await db(
            `users?username=eq.${encodeURIComponent(username)}&select=id&limit=1`
        );


    if(
        existing.data &&
        existing.data.length
    ){

        throw new Error(
            "Такой логин уже существует."
        );

    }


    const expires =
        new Date(
            Date.now() +
            hours * 60 * 60 * 1000
        )
        .toISOString();


    const result =
        await db(
            "users",
            {
                method:"POST",

                headers:{
                    "Prefer":
                        "return=representation"
                },

                body:JSON.stringify({

                    username,

                    password_hash:
                        passwordHash(
                            password
                        ),

                    created_at:
                        currentTime(),

                    expires_at:
                        expires,

                    is_blocked:
                        false

                })
            }
        );


    await log(
        "USER_CREATE",
        `Создан аккаунт ${username}.`
    );


    return {

        user:
            result.data?.[0] ||
            {
                username,
                expires_at:expires
            },

        generatedPassword:
            body.password
            ? null
            : password

    };

}


/* =========================================================
   DELETE USER
========================================================= */

async function deleteUser(
    body
){

    if(!body.id){

        throw new Error(
            "Не указан ID аккаунта."
        );

    }


    await db(
        `users?id=eq.${encodeURIComponent(body.id)}`,
        {
            method:"DELETE",

            headers:{
                "Prefer":
                    "return=minimal"
            }
        }
    );


    await log(
        "USER_DELETE",
        `Удалён аккаунт ${body.id}.`
    );


    return {
        ok:true
    };

}


/* =========================================================
   SYSTEM SETTINGS
========================================================= */

async function setSystem(
    body
){

    const allowedModes = [
        "online",
        "maintenance",
        "error"
    ];


    const mode =
        allowedModes.includes(
            body.mode
        )
        ?
        body.mode
        :
        "online";


    const code =
        String(
            body.code ||
            (
                mode === "online"
                ? "ONLINE"
                :
                mode === "maintenance"
                ? "MAINTENANCE"
                : "SYSTEM_ERROR"
            )
        )
        .slice(0,80);


    const message =
        String(
            body.message || ""
        )
        .slice(0,1000);


    await db(
        "settings?id=eq.1",
        {
            method:"PATCH",

            headers:{
                "Prefer":
                    "return=minimal"
            },

            body:JSON.stringify({

                mode,

                code,

                message,

                updated_at:
                    currentTime()

            })
        }
    );


    await log(
        "SYSTEM_STATUS",
        `Режим сайта изменён на ${mode}.`
    );


    return {
        config:
            await getSettings()
    };

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    request
){

    /*
    Разрешаем браузеру обращаться к API.
    */

    if(
        request.method === "OPTIONS"
    ){

        return new Response(
            null,
            {
                status:204,

                headers:{
                    "Access-Control-Allow-Origin":"*",
                    "Access-Control-Allow-Headers":"Content-Type",
                    "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
                }
            }
        );

    }


    try{

        const url =
            new URL(
                request.url
            );


        const action =
            url.searchParams.get(
                "action"
            ) ||
            "public";


        let body={};


        if(
            request.method !== "GET"
        ){

            try{

                body =
                    await request.json();

            }catch{

                body={};

            }

        }


        /* ================================================
           PUBLIC
        ================================================= */

        if(
            action === "public"
        ){

            return response(
                200,
                await publicData()
            );

        }


        /* ================================================
           TRACK
        ================================================= */

        if(
            action === "track"
        ){

            return response(
                200,
                await trackVisitor(
                    body
                )
            );

        }


        /* ================================================
           USER LOGIN
        ================================================= */

        if(
            action === "login"
        ){

            return response(
                200,
                await loginUser(
                    body
                )
            );

        }


        /* ================================================
           USER PROFILE
        ================================================= */

        if(
            action === "profile"
        ){

            return response(
                200,
                await getProfile(
                    body
                )
            );

        }


        /* ================================================
           ADMIN LOGIN
        ================================================= */

        if(
            action === "adminLogin"
        ){

            if(
                body.login !==
                ADMIN_LOGIN ||

                body.password !==
                ADMIN_PASSWORD
            ){

                return response(
                    401,
                    {
                        error:
                            "Неверный логин или пароль."
                    }
                );

            }


            return response(
                200,
                {
                    token:
                        createAdminToken()
                }
            );

        }


        /* ================================================
           ADMIN SECURITY
        ================================================= */

        const protectedActions = [

            "adminStats",

            "createUser",

            "deleteUser",

            "setSystem"

        ];


        if(
            protectedActions.includes(
                action
            )
        ){

            if(
                !verifyAdminToken(
                    body.token
                )
            ){

                return response(
                    401,
                    {
                        error:
                            "Нет доступа к админ-панели."
                    }
                );

            }

        }


        /* ================================================
           ADMIN STATS
        ================================================= */

        if(
            action === "adminStats"
        ){

            return response(
                200,
                await adminStats()
            );

        }


        /* ================================================
           CREATE USER
        ================================================= */

        if(
            action === "createUser"
        ){

            return response(
                200,
                await createUser(
                    body
                )
            );

        }


        /* ================================================
           DELETE USER
        ================================================= */

        if(
            action === "deleteUser"
        ){

            return response(
                200,
                await deleteUser(
                    body
                )
            );

        }


        /* ================================================
           SYSTEM SETTINGS
        ================================================= */

        if(
            action === "setSystem"
        ){

            return response(
                200,
                await setSystem(
                    body
                )
            );

        }


        return response(
            404,
            {
                error:
                    "Такого API метода нет."
            }
        );

    }catch(error){

        console.error(
            "API ERROR:",
            error
        );


        return response(
            500,
            {
                error:
                    error.message ||
                    "Внутренняя ошибка сервера."
            }
        );

    }

}
