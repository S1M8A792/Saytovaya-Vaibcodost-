// =========================================================
// EDUAI — APP.JS
// Совместим с non-streaming /api/chat
// =========================================================


// =========================================================
// ELEMENTS
// =========================================================

const screens = document.querySelectorAll(".screen");

const sidebar = document.getElementById("sidebar");
const menu = document.getElementById("menu");

const sendButton = document.getElementById("send");
const questionInput = document.getElementById("question");

const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatMessages = document.getElementById("chatMessages");

const accountButton = document.getElementById("accountButton");
const accountMenu = document.getElementById("accountMenu");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const newChatButton = document.getElementById("newChatButton");
const chatHistoryList = document.getElementById("chatHistoryList");


// =========================================================
// STATE
// =========================================================

let chats = [];
let activeChatId = null;
let isSending = false;


// =========================================================
// SMALL HELPERS
// =========================================================

function uid() {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getMessageText(message) {

    if (!message || !Array.isArray(message.parts)) {
        return "";
    }

    return message.parts
        .map(part => part?.text || "")
        .join("");
}


// =========================================================
// CHAT NORMALIZATION
// =========================================================

function normalizeMessage(message) {

    if (!message) {
        return null;
    }

    const role =
        message.role === "model"
            ? "model"
            : message.role === "user"
                ? "user"
                : null;

    if (!role) {
        return null;
    }

    const text = getMessageText(message);

    if (!text.trim()) {
        return null;
    }

    return {
        id: message.id || uid(),
        role,
        parts: [
            {
                text
            }
        ]
    };
}


function normalizeChat(chat) {

    if (!chat || !chat.id) {
        return null;
    }

    const messages =
        Array.isArray(chat.messages)
            ? chat.messages
                .map(normalizeMessage)
                .filter(Boolean)
            : [];

    return {
        id: String(chat.id),

        title:
            typeof chat.title === "string" &&
            chat.title.trim()
                ? chat.title
                : "Новый чат",

        messages,

        createdAt:
            Number(chat.createdAt) ||
            Date.now(),

        updatedAt:
            Number(chat.updatedAt) ||
            Number(chat.createdAt) ||
            Date.now()
    };
}


// =========================================================
// LOAD CHAT HISTORY
// =========================================================

function loadChats() {

    try {

        const raw =
            localStorage.getItem("eduai_chats");

        if (!raw) {
            chats = [];
            return;
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            chats = [];
            return;
        }

        chats = parsed
            .map(normalizeChat)
            .filter(Boolean);

    } catch (error) {

        console.error(
            "Не удалось загрузить историю чатов:",
            error
        );

        chats = [];
    }
}


// =========================================================
// SAVE CHAT HISTORY
// =========================================================

function saveChats() {

    try {

        localStorage.setItem(
            "eduai_chats",
            JSON.stringify(chats)
        );

    } catch (error) {

        console.error(
            "Не удалось сохранить историю чатов:",
            error
        );
    }
}


// =========================================================
// ACTIVE CHAT
// =========================================================

function getActiveChat() {

    if (!activeChatId) {
        return null;
    }

    return (
        chats.find(
            chat => chat.id === activeChatId
        ) || null
    );
}


function createChat() {

    const chat = {

        id: uid(),

        title: "Новый чат",

        messages: [],

        createdAt: Date.now(),

        updatedAt: Date.now()

    };

    chats.unshift(chat);

    activeChatId = chat.id;

    saveChats();

    renderChatHistoryList();

    return chat;
}


function getOrCreateActiveChat() {

    const active = getActiveChat();

    if (active) {
        return active;
    }

    return createChat();
}


// =========================================================
// UPDATE CHAT TITLE
// =========================================================

function updateChatTitle(chat, text) {

    if (!chat) {
        return;
    }

    if (chat.title !== "Новый чат") {
        return;
    }

    const cleanText =
        String(text)
            .replace(/\s+/g, " ")
            .trim();

    if (!cleanText) {
        return;
    }

    chat.title =
        cleanText.length > 42
            ? cleanText.slice(0, 42) + "…"
            : cleanText;

    chat.updatedAt = Date.now();

    saveChats();

    renderChatHistoryList();
}


// =========================================================
// NAVIGATION
// =========================================================

function show(name) {

    screens.forEach(screen => {

        screen.classList.toggle(
            "active",
            screen.id === name
        );

    });

    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }

    closeAccountMenu();

    if (name === "chat") {

        renderChatHistory();

        renderChatHistoryList();
    }
}


document
    .querySelectorAll("[data-screen]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                show(
                    button.dataset.screen
                );

            }
        );

    });


// =========================================================
// MOBILE SIDEBAR
// =========================================================

if (menu && sidebar) {

    menu.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            sidebar.classList.toggle(
                "open"
            );

        }
    );
}


document.addEventListener(
    "click",
    event => {

        if (!sidebar || !menu) {
            return;
        }

        if (!sidebar.classList.contains("open")) {
            return;
        }

        if (sidebar.contains(event.target)) {
            return;
        }

        if (menu.contains(event.target)) {
            return;
        }

        sidebar.classList.remove("open");
    }
);


// =========================================================
// SUBJECTS
// =========================================================

async function loadSubjects() {

    const box =
        document.getElementById("subjects");

    if (!box) {
        return;
    }

    try {

        const response =
            await fetch("/api/subjects");

        if (!response.ok) {

            throw new Error(
                `Ошибка загрузки предметов: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (!Array.isArray(data)) {

            throw new Error(
                "Сервер вернул неправильный формат предметов."
            );
        }

        box.innerHTML =
            data.map(subject => {

                const progress =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            Number(subject.progress) || 0
                        )
                    );

                return `
                    <article class="subject">

                        <div class="subject-main">

                            <div class="subject-icon">
                                ${escapeHTML(subject.icon || "")}
                            </div>

                            <h3>
                                ${escapeHTML(
                    subject.name || "Предмет"
                )}
                            </h3>

                            <div class="bar">

                                <i
                                    style="width:${progress}%"
                                ></i>

                            </div>

                            <div class="pct">
                                ${progress}% пройдено
                            </div>

                        </div>

                        <div class="subject-details">

                            <div class="subject-details-inner">

                                <p>
                                    <b>Последняя тема:</b>
                                    Квадратные уравнения
                                </p>

                                <p>
                                    <b>Ошибок в тесте:</b>
                                    2
                                </p>

                                <p>
                                    <b>Следующая тема:</b>
                                    Теорема Виета
                                </p>

                                <p>
                                    <b>Прогресс:</b>
                                    ${progress}%
                                </p>

                            </div>

                        </div>

                    </article>
                `;

            }).join("");

        document
            .querySelectorAll(".subject")
            .forEach(card => {

                card.addEventListener(
                    "click",
                    () => {

                        card.classList.toggle(
                            "expanded"
                        );

                    }
                );

            });

    } catch (error) {

        console.error(
            "Ошибка загрузки предметов:",
            error
        );

        box.innerHTML = `
            <p>
                Не удалось загрузить предметы.
            </p>
        `;
    }
}


// =========================================================
// CHAT RICH TEXT
// Markdown + LaTeX
// =========================================================

function extractMath(text) {

    const math = [];

    let source = String(text ?? "");


    function replaceMath(
        regex,
        displayMode
    ) {

        source =
            source.replace(
                regex,
                (_, expression) => {

                    const index =
                        math.push({
                            expression:
                                String(expression).trim(),
                            displayMode
                        }) - 1;

                    return `\uE000MATH${index}\uE001`;
                }
            );
    }


    // Display math
    replaceMath(
        /\$\$([\s\S]+?)\$\$/g,
        true
    );


    replaceMath(
        /\\\[([\s\S]+?)\\\]/g,
        true
    );


    // Inline math
    replaceMath(
        /\\\(([\s\S]+?)\\\)/g,
        false
    );


    replaceMath(
        /(?<!\$)\$([^$\n]+?)\$(?!\$)/g,
        false
    );


    return {
        source,
        math
    };
}


function renderRichText(text) {

    const safeText =
        String(text ?? "");


    if (!safeText) {
        return "";
    }


    // Если библиотеки ещё не загрузились
    if (
        typeof marked === "undefined" ||
        typeof DOMPurify === "undefined"
    ) {

        return escapeHTML(
            safeText
        );
    }


    const extracted =
        extractMath(
            safeText
        );


    let html;

    try {

        html =
            marked.parse(
                extracted.source,
                {
                    breaks: true,
                    gfm: true
                }
            );

    } catch (error) {

        console.error(
            "Markdown error:",
            error
        );

        return escapeHTML(
            safeText
        );
    }


    html =
        DOMPurify.sanitize(
            html,
            {
                USE_PROFILES: {
                    html: true
                }
            }
        );


    const wrapper =
        document.createElement("div");

    wrapper.innerHTML = html;


    if (
        typeof katex !== "undefined" &&
        extracted.math.length > 0
    ) {

        const walker =
            document.createTreeWalker(
                wrapper,
                NodeFilter.SHOW_TEXT
            );


        const textNodes = [];

        let current;

        while (
            current =
                walker.nextNode()
            ) {

            textNodes.push(
                current
            );
        }


        textNodes.forEach(node => {

            let value =
                node.nodeValue;


            extracted.math.forEach(
                (_, index) => {

                    const token =
                        `\uE000MATH${index}\uE001`;

                    if (
                        !value.includes(token)
                    ) {
                        return;
                    }


                    const parts =
                        value.split(token);


                    const fragment =
                        document.createDocumentFragment();


                    parts.forEach(
                        (part, partIndex) => {

                            if (part) {

                                fragment.appendChild(
                                    document.createTextNode(
                                        part
                                    )
                                );
                            }


                            if (
                                partIndex <
                                parts.length - 1
                            ) {

                                const mathData =
                                    extracted.math[index];


                                const span =
                                    document.createElement(
                                        "span"
                                    );


                                span.className =
                                    mathData.displayMode
                                        ? "math-display"
                                        : "math-inline";


                                try {

                                    katex.render(
                                        mathData.expression,
                                        span,
                                        {
                                            displayMode:
                                            mathData.displayMode,
                                            throwOnError: false,
                                            strict: "ignore"
                                        }
                                    );

                                } catch (error) {

                                    console.error(
                                        "KaTeX error:",
                                        error
                                    );

                                    span.textContent =
                                        mathData.expression;
                                }


                                fragment.appendChild(
                                    span
                                );
                            }

                        }
                    );


                    node.parentNode.replaceChild(
                        fragment,
                        node
                    );

                }
            );

        });

    }


    return wrapper.innerHTML;
}


// =========================================================
// MESSAGE ACTION ICONS
// =========================================================

function iconCopy() {

    return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect
                x="8"
                y="8"
                width="11"
                height="11"
                rx="2"
            ></rect>

            <path
                d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"
            ></path>
        </svg>
    `;
}


function iconEdit() {

    return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3z"
            ></path>

            <path
                d="M14.5 6.5l3 3"
            ></path>
        </svg>
    `;
}


function iconRefresh() {

    return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M20 11a8 8 0 0 0-14.9-4"
            ></path>

            <path
                d="M4 4v5h5"
            ></path>

            <path
                d="M4 13a8 8 0 0 0 14.9 4"
            ></path>

            <path
                d="M20 20v-5h-5"
            ></path>
        </svg>
    `;
}


function createActionButton(
    action,
    label,
    icon
) {

    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "message-action-button";

    button.dataset.action =
        action;

    button.title =
        label;

    button.setAttribute(
        "aria-label",
        label
    );

    button.innerHTML =
        icon;

    return button;
}


// =========================================================
// CHAT UI STYLE SAFETY
// =========================================================

function ensureChatActionStyles() {

    if (
        document.getElementById(
            "eduai-chat-action-styles"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");

    style.id =
        "eduai-chat-action-styles";


    style.textContent = `

        .chat-message {
            position: relative;
        }

        .chat-message-content {
            min-width: 0;
        }

        .chat-message-content p:first-child {
            margin-top: 0;
        }

        .chat-message-content p:last-child {
            margin-bottom: 0;
        }

        .chat-message-content pre {
            overflow-x: auto;
        }

        .chat-message-content code {
            font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;
        }

        .chat-message-content .math-display {
            display: block;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 5px 0;
        }

        .message-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 7px;
            opacity: 0;
            transform: translateY(3px);
            pointer-events: none;
            transition:
                opacity .18s ease,
                transform .18s ease;
        }

        .chat-message:hover .message-actions,
        .chat-message:focus-within .message-actions {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }

        .message-action-button {
            width: 28px;
            height: 28px;
            padding: 0;
            display: inline-grid;
            place-items: center;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: currentColor;
            cursor: pointer;
            opacity: .62;
            transition:
                background .18s ease,
                opacity .18s ease,
                transform .18s ease;
        }

        .message-action-button:hover {
            background: rgba(255,255,255,.08);
            opacity: 1;
            transform: translateY(-1px);
        }

        .message-action-button svg {
            width: 16px;
            height: 16px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .chat-message.user .message-actions {
            justify-content: flex-end;
        }

        .chat-message.ai .message-actions {
            justify-content: flex-start;
        }

        .chat-message-typing {
            white-space: pre-wrap;
        }

        .chat-message-error {
            opacity: .8;
        }

        .chat-message-edit {
            width: 100%;
            min-height: 80px;
            resize: vertical;
            box-sizing: border-box;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(8,10,20,.55);
            color: inherit;
            font: inherit;
            outline: none;
        }

        .chat-message-edit:focus {
            border-color: rgba(140,120,255,.40);
            box-shadow: 0 0 0 3px rgba(120,100,255,.10);
        }

        .edit-buttons {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .edit-buttons button {
            border: 0;
            border-radius: 9px;
            padding: 7px 11px;
            cursor: pointer;
            font: inherit;
        }

        .edit-save {
            background: rgba(255,255,255,.92);
            color: #11121a;
        }

        .edit-cancel {
            background: rgba(255,255,255,.08);
            color: inherit;
        }

        @media (hover: none) {
            .message-actions {
                opacity: 1;
                transform: none;
                pointer-events: auto;
            }
        }
    `;


    document.head.appendChild(
        style
    );
}


// =========================================================
// CREATE MESSAGE ELEMENT
// =========================================================

function createMessageElement(
    message,
    options = {}
) {

    if (!chatMessages) {
        return null;
    }


    const text =
        getMessageText(message);


    if (!text) {
        return null;
    }


    const type =
        message.role === "model"
            ? "ai"
            : "user";


    const element =
        document.createElement("div");


    element.className =
        `chat-message ${type}`;


    element.dataset.messageId =
        message.id || "";


    const content =
        document.createElement("div");


    content.className =
        "chat-message-content";


    if (options.typing) {

        content.classList.add(
            "chat-message-typing"
        );

        content.textContent =
            text;

    } else {

        content.innerHTML =
            renderRichText(text);

    }


    element.appendChild(
        content
    );


    // -----------------------------------------
    // ACTIONS
    // -----------------------------------------

    if (!options.typing && !options.error) {

        const actions =
            document.createElement("div");


        actions.className =
            "message-actions";


        if (type === "user") {

            actions.appendChild(
                createActionButton(
                    "edit",
                    "Изменить",
                    iconEdit()
                )
            );

            actions.appendChild(
                createActionButton(
                    "copy",
                    "Копировать",
                    iconCopy()
                )
            );

        } else {

            actions.appendChild(
                createActionButton(
                    "copy",
                    "Копировать",
                    iconCopy()
                )
            );

            actions.appendChild(
                createActionButton(
                    "regenerate",
                    "Сгенерировать заново",
                    iconRefresh()
                )
            );

        }


        element.appendChild(
            actions
        );
    }


    return element;
}


// =========================================================
// ADD MESSAGE
// =========================================================

function addChatMessage(
    text,
    type,
    options = {}
) {

    if (!chatMessages) {
        return null;
    }


    const empty =
        chatMessages.querySelector(
            ".chat-empty"
        );


    if (empty) {
        empty.remove();
    }


    const message = {

        id:
            options.id || uid(),

        role:
            type === "ai"
                ? "model"
                : "user",

        parts: [
            {
                text:
                    String(text ?? "")
            }
        ]

    };


    const element =
        createMessageElement(
            message,
            options
        );


    if (!element) {
        return null;
    }


    chatMessages.appendChild(
        element
    );


    scrollChatToBottom();


    return element;
}


// =========================================================
// SCROLL
// =========================================================

function scrollChatToBottom() {

    if (!chatMessages) {
        return;
    }

    requestAnimationFrame(
        () => {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }
    );
}


// =========================================================
// EMPTY CHAT
// =========================================================

function renderEmptyChat() {

    if (!chatMessages) {
        return;
    }


    chatMessages.innerHTML = `

        <div class="chat-empty">

            <div class="chat-empty-icon">
                ✦
            </div>

            <h2>
                Чем могу помочь?
            </h2>

            <p>
                Спроси про математику, физику,
                программирование или любой другой
                учебный предмет.
            </p>

        </div>

    `;
}


// =========================================================
// RENDER ACTIVE CHAT
// =========================================================

function renderChatHistory() {

    if (!chatMessages) {
        return;
    }


    chatMessages.innerHTML = "";


    const chat =
        getActiveChat();


    if (
        !chat ||
        !Array.isArray(chat.messages) ||
        chat.messages.length === 0
    ) {

        renderEmptyChat();

        return;
    }


    chat.messages.forEach(
        message => {

            const element =
                createMessageElement(
                    message
                );

            if (element) {

                chatMessages.appendChild(
                    element
                );
            }

        }
    );


    scrollChatToBottom();
}


// =========================================================
// RENDER SIDEBAR HISTORY
// =========================================================

function renderChatHistoryList() {

    if (!chatHistoryList) {
        return;
    }


    if (!chats.length) {

        chatHistoryList.innerHTML = `

            <div class="chat-history-empty">
                Здесь появятся твои чаты.
            </div>

        `;

        return;
    }


    const sorted =
        [...chats].sort(
            (a, b) =>
                (b.updatedAt || b.createdAt || 0) -
                (a.updatedAt || a.createdAt || 0)
        );


    chatHistoryList.innerHTML = "";


    sorted.forEach(chat => {

        const button =
            document.createElement("button");


        button.type = "button";

        button.className =
            "history-chat";


        if (
            chat.id === activeChatId
        ) {

            button.classList.add(
                "active"
            );
        }


        button.dataset.chatId =
            chat.id;


        button.title =
            chat.title;


        const title =
            document.createElement("span");


        title.className =
            "history-chat-title";


        title.textContent =
            chat.title;


        button.appendChild(
            title
        );


        button.addEventListener(
            "click",
            () => {

                activeChatId =
                    chat.id;

                renderChatHistoryList();

                renderChatHistory();

                show("chat");

            }
        );


        chatHistoryList.appendChild(
            button
        );

    });
}


// =========================================================
// NEW CHAT
// =========================================================

if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        () => {

            if (isSending) {
                return;
            }

            // Не создаём пустой чат.
            // Новый чат появится после первого сообщения.

            activeChatId = null;

            renderEmptyChat();

            renderChatHistoryList();

            show("chat");

            if (chatInput) {
                chatInput.focus();
            }

        }
    );
}


// =========================================================
// SMOOTH TEXT REVEAL
// =========================================================

function smoothReveal(
    element,
    text
) {

    return new Promise(resolve => {

        if (!element) {
            resolve();
            return;
        }


        const value =
            String(text ?? "");


        element.textContent =
            "";


        if (!value) {

            resolve();

            return;
        }


        let index = 0;


        const chunkSize =
            Math.max(
                1,
                Math.ceil(
                    value.length / 120
                )
            );


        function frame() {

            index =
                Math.min(
                    value.length,
                    index + chunkSize
                );


            element.textContent =
                value.slice(
                    0,
                    index
                );


            scrollChatToBottom();


            if (
                index >=
                value.length
            ) {

                resolve();

                return;
            }


            requestAnimationFrame(
                frame
            );
        }


        requestAnimationFrame(
            frame
        );

    });
}


// =========================================================
// COMPOSER BUSY
// =========================================================

function setComposerBusy(
    busy
) {

    isSending = busy;


    if (chatSend) {
        chatSend.disabled =
            busy;
    }

    if (sendButton) {
        sendButton.disabled =
            busy;
    }

    if (chatInput) {
        chatInput.disabled =
            busy;
    }

    if (questionInput) {
        questionInput.disabled =
            busy;
    }
}


// =========================================================
// API REQUEST
// =========================================================

async function requestAssistantResponse(
    chat,
    userText,
    existingAiElement = null
) {

    if (!chat) {
        return;
    }


    const history =
        chat.messages.slice(
            0,
            -1
        );


    let aiElement =
        existingAiElement;


    if (!aiElement) {

        const temporaryMessage = {

            id: uid(),

            role: "model",

            parts: [
                {
                    text:
                        "EduAI печатает..."
                }
            ]

        };


        aiElement =
            createMessageElement(
                temporaryMessage,
                {
                    typing: true
                }
            );


        if (aiElement) {

            const empty =
                chatMessages.querySelector(
                    ".chat-empty"
                );

            if (empty) {
                empty.remove();
            }

            chatMessages.appendChild(
                aiElement
            );

            scrollChatToBottom();
        }

    }


    const content =
        aiElement?.querySelector(
            ".chat-message-content"
        );


    if (content) {
        content.textContent =
            "EduAI печатает...";
    }


    try {

        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                            userText,

                            history:
                            history

                        })
                }
            );


        const answerText =
            await response.text();


        if (!response.ok) {

            throw new Error(
                answerText ||
                `Ошибка сервера: ${response.status}`
            );
        }


        const answer =
            answerText.trim();


        if (!answer) {

            throw new Error(
                "Gemini вернул пустой ответ."
            );
        }


        // -------------------------------------
        // SMOOTH GENERATION
        // -------------------------------------

        if (content) {

            await smoothReveal(
                content,
                answer
            );


            content.innerHTML =
                renderRichText(
                    answer
                );
        }


        // -------------------------------------
        // SAVE AI MESSAGE
        // -------------------------------------

        chat.messages.push({

            id: uid(),

            role: "model",

            parts: [
                {
                    text: answer
                }
            ]

        });


        chat.updatedAt =
            Date.now();


        saveChats();


        // Добавляем кнопки действий
        if (aiElement) {

            const oldActions =
                aiElement.querySelector(
                    ".message-actions"
                );

            if (oldActions) {
                oldActions.remove();
            }


            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "message-actions";


            actions.appendChild(
                createActionButton(
                    "copy",
                    "Копировать",
                    iconCopy()
                )
            );


            actions.appendChild(
                createActionButton(
                    "regenerate",
                    "Сгенерировать заново",
                    iconRefresh()
                )
            );


            aiElement.appendChild(
                actions
            );
        }


        renderChatHistoryList();

        scrollChatToBottom();


    } catch (error) {

        console.error(
            "Ошибка Gemini:",
            error
        );


        if (content) {

            content.textContent =
                `Ошибка ИИ: ${
                    error?.message ||
                    "Неизвестная ошибка"
                }`;
        }


        if (aiElement) {

            aiElement.classList.add(
                "chat-message-error"
            );
        }

    }
}


// =========================================================
// SEND NEW MESSAGE
// =========================================================

async function sendChatMessage(
    message
) {

    const cleanMessage =
        String(message ?? "")
            .trim();


    if (
        !cleanMessage ||
        isSending
    ) {
        return;
    }


    setComposerBusy(true);


    try {

        const chat =
            getOrCreateActiveChat();


        // -------------------------------------
        // USER MESSAGE
        // -------------------------------------

        const userMessage = {

            id: uid(),

            role: "user",

            parts: [
                {
                    text:
                    cleanMessage
                }
            ]

        };


        chat.messages.push(
            userMessage
        );


        chat.updatedAt =
            Date.now();


        updateChatTitle(
            chat,
            cleanMessage
        );


        saveChats();


        // -------------------------------------
        // CLEAR INPUT
        // -------------------------------------

        if (chatInput) {
            chatInput.value = "";
        }

        if (questionInput) {
            questionInput.value = "";
        }


        // -------------------------------------
        // DRAW USER MESSAGE
        // -------------------------------------

        renderChatHistory();


        // -------------------------------------
        // ASK GEMINI
        // -------------------------------------

        await requestAssistantResponse(
            chat,
            cleanMessage
        );

    } finally {

        setComposerBusy(false);

        if (chatInput) {
            chatInput.disabled = false;
        }

        if (questionInput) {
            questionInput.disabled = false;
        }
    }
}


// =========================================================
// HOME SEND
// =========================================================

if (
    sendButton &&
    questionInput
) {

    sendButton.addEventListener(
        "click",
        async () => {

            const message =
                questionInput.value.trim();


            if (!message) {
                return;
            }


            show("chat");


            await sendChatMessage(
                message
            );

        }
    );


    questionInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendButton.click();

            }

        }
    );
}


// =========================================================
// CHAT INPUT
// =========================================================

if (
    chatSend &&
    chatInput
) {

    chatSend.addEventListener(
        "click",
        async () => {

            const message =
                chatInput.value.trim();


            if (!message) {
                return;
            }


            await sendChatMessage(
                message
            );

        }
    );


    chatInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                chatSend.click();

            }

        }
    );
}


// =========================================================
// COPY
// =========================================================

async function copyText(
    text
) {

    const value =
        String(text ?? "");


    if (!value) {
        return;
    }


    try {

        await navigator.clipboard.writeText(
            value
        );

        showToast(
            "Скопировано"
        );

    } catch (error) {

        console.error(
            "Ошибка копирования:",
            error
        );


        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            value;

        textarea.style.position =
            "fixed";

        textarea.style.opacity =
            "0";

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand(
            "copy"
        );

        textarea.remove();

        showToast(
            "Скопировано"
        );
    }
}


// =========================================================
// EDIT USER MESSAGE
// =========================================================

function editUserMessage(
    messageId
) {

    const chat =
        getActiveChat();

    if (!chat) {
        return;
    }


    const index =
        chat.messages.findIndex(
            message =>
                message.id === messageId
        );


    if (index === -1) {
        return;
    }


    const message =
        chat.messages[index];


    if (
        message.role !== "user"
    ) {
        return;
    }


    const element =
        chatMessages.querySelector(
            `[data-message-id="${CSS.escape(messageId)}"]`
        );


    if (!element) {
        return;
    }


    const content =
        element.querySelector(
            ".chat-message-content"
        );


    const actions =
        element.querySelector(
            ".message-actions"
        );


    const oldText =
        getMessageText(message);


    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.className =
        "chat-message-edit";


    textarea.value =
        oldText;


    textarea.rows = 3;


    const editButtons =
        document.createElement(
            "div"
        );


    editButtons.className =
        "edit-buttons";


    const saveButton =
        document.createElement(
            "button"
        );

    saveButton.type = "button";

    saveButton.className =
        "edit-save";

    saveButton.textContent =
        "Сохранить";


    const cancelButton =
        document.createElement(
            "button"
        );

    cancelButton.type = "button";

    cancelButton.className =
        "edit-cancel";

    cancelButton.textContent =
        "Отмена";


    editButtons.appendChild(
        saveButton
    );

    editButtons.appendChild(
        cancelButton
    );


    if (content) {

        content.innerHTML = "";

        content.appendChild(
            textarea
        );

        content.appendChild(
            editButtons
        );
    }


    if (actions) {
        actions.remove();
    }


    textarea.focus();


    cancelButton.addEventListener(
        "click",
        () => {

            renderChatHistory();

        }
    );


    saveButton.addEventListener(
        "click",
        async () => {

            const newText =
                textarea.value.trim();


            if (!newText) {
                return;
            }


            // Удаляем это сообщение
            // и всё, что было после него.

            chat.messages.splice(
                index
            );


            chat.updatedAt =
                Date.now();


            saveChats();


            renderChatHistory();


            // Отправляем изменённый вариант
            await sendChatMessage(
                newText
            );

        }
    );
}


// =========================================================
// REGENERATE
// =========================================================

async function regenerateFromAI(
    messageId
) {

    if (isSending) {
        return;
    }


    const chat =
        getActiveChat();

    if (!chat) {
        return;
    }


    const aiIndex =
        chat.messages.findIndex(
            message =>
                message.id === messageId
        );


    if (aiIndex === -1) {
        return;
    }


    const aiMessage =
        chat.messages[aiIndex];


    if (
        aiMessage.role !== "model"
    ) {
        return;
    }


    const userIndex =
        aiIndex - 1;


    if (userIndex < 0) {
        return;
    }


    const userMessage =
        chat.messages[userIndex];


    if (
        userMessage.role !== "user"
    ) {
        return;
    }


    const userText =
        getMessageText(
            userMessage
        ).trim();


    if (!userText) {
        return;
    }


    setComposerBusy(true);


    try {

        // Удаляем старый AI-ответ
        // и всё после него.

        chat.messages.splice(
            aiIndex
        );


        chat.updatedAt =
            Date.now();


        saveChats();


        renderChatHistory();


        await requestAssistantResponse(
            chat,
            userText
        );

    } finally {

        setComposerBusy(false);

    }
}


// =========================================================
// MESSAGE ACTION HANDLER
// =========================================================

if (chatMessages) {

    chatMessages.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    ".message-action-button"
                );


            if (!button) {
                return;
            }


            const element =
                button.closest(
                    ".chat-message"
                );


            if (!element) {
                return;
            }


            const messageId =
                element.dataset.messageId;


            const action =
                button.dataset.action;


            const chat =
                getActiveChat();


            if (!chat) {
                return;
            }


            const message =
                chat.messages.find(
                    item =>
                        item.id ===
                        messageId
                );


            if (!message) {
                return;
            }


            const text =
                getMessageText(
                    message
                );


            if (action === "copy") {

                await copyText(
                    text
                );

                return;
            }


            if (action === "edit") {

                editUserMessage(
                    messageId
                );

                return;
            }


            if (
                action === "regenerate"
            ) {

                await regenerateFromAI(
                    messageId
                );

            }

        }
    );
}


// =========================================================
// ACCOUNT MENU
// =========================================================

const accountWindow =
    accountMenu?.querySelector(
        ".account-window"
    );


function openAccountMenu() {

    if (
        !accountButton ||
        !accountMenu
    ) {
        return;
    }


    const rect =
        accountButton.getBoundingClientRect();


    const x =
        rect.left +
        rect.width / 2;


    const y =
        rect.top +
        rect.height / 2;


    accountMenu.style.setProperty(
        "--origin-x",
        `${x}px`
    );


    accountMenu.style.setProperty(
        "--origin-y",
        `${y}px`
    );


    accountMenu.classList.add(
        "open"
    );


    accountMenu.setAttribute(
        "aria-hidden",
        "false"
    );
}


function closeAccountMenu() {

    if (!accountMenu) {
        return;
    }


    accountMenu.classList.remove(
        "open"
    );


    accountMenu.setAttribute(
        "aria-hidden",
        "true"
    );
}


if (
    accountButton &&
    accountMenu
) {

    accountButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                accountMenu.classList.contains(
                    "open"
                )
            ) {

                closeAccountMenu();

            } else {

                openAccountMenu();

            }

        }
    );


    if (accountWindow) {

        accountWindow.addEventListener(
            "click",
            event => {

                event.stopPropagation();

            }
        );

    }


    document.addEventListener(
        "click",
        event => {

            if (
                !accountMenu.classList.contains(
                    "open"
                )
            ) {
                return;
            }


            if (
                accountButton.contains(
                    event.target
                )
            ) {
                return;
            }


            if (
                accountWindow &&
                accountWindow.contains(
                    event.target
                )
            ) {
                return;
            }


            closeAccountMenu();

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeAccountMenu();

            }

        }
    );
}


// =========================================================
// LOGIN / REGISTER SWITCH
// =========================================================

if (
    showRegister &&
    accountWindow
) {

    showRegister.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            accountWindow.classList.add(
                "register-mode"
            );

        }
    );
}


if (
    showLogin &&
    accountWindow
) {

    showLogin.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            accountWindow.classList.remove(
                "register-mode"
            );

        }
    );
}


// =========================================================
// AUTH FORMS
// =========================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const email =
                document.getElementById(
                    "loginEmail"
                )?.value.trim();

            const password =
                document.getElementById(
                    "loginPassword"
                )?.value;


            if (
                !email ||
                !password
            ) {
                showToast(
                    "Заполни все поля."
                );

                return;
            }


            showToast(
                "Авторизация пока не подключена к серверу."
            );

        }
    );
}


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const name =
                document.getElementById(
                    "registerName"
                )?.value.trim();

            const email =
                document.getElementById(
                    "registerEmail"
                )?.value.trim();

            const password =
                document.getElementById(
                    "registerPassword"
                )?.value;


            if (
                !name ||
                !email ||
                !password
            ) {
                showToast(
                    "Заполни все поля."
                );

                return;
            }


            showToast(
                "Регистрация пока не подключена к серверу."
            );

        }
    );
}


// =========================================================
// SOCIAL BUTTONS
// =========================================================

document
    .querySelectorAll(
        ".google-button, .apple-button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showToast(
                    "Вход через этот сервис пока не подключён."
                );

            }
        );

    });


// =========================================================
// TOAST
// =========================================================

function ensureToastStyles() {

    if (
        document.getElementById(
            "eduai-toast-styles"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");


    style.id =
        "eduai-toast-styles";


    style.textContent = `

        .eduai-toast {
            position: fixed;
            left: 50%;
            bottom: 28px;
            z-index: 99999;
            transform: translate(-50%, 12px);
            padding: 10px 15px;
            border-radius: 12px;
            background: rgba(15,17,29,.88);
            border: 1px solid rgba(255,255,255,.08);
            color: rgba(255,255,255,.94);
            box-shadow:
                0 18px 50px rgba(0,0,0,.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            opacity: 0;
            pointer-events: none;
            transition:
                opacity .22s ease,
                transform .22s ease;
            font-size: 13px;
        }

        .eduai-toast.show {
            opacity: 1;
            transform: translate(-50%, 0);
        }

    `;


    document.head.appendChild(
        style
    );
}


let toastTimer = null;


function showToast(
    text
) {

    ensureToastStyles();


    let toast =
        document.querySelector(
            ".eduai-toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.className =
            "eduai-toast";

        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        text;


    requestAnimationFrame(
        () => {

            toast.classList.add(
                "show"
            );

        }
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2200
        );
}


// =========================================================
// SUPPORT
// =========================================================

const supportButton =
    document.getElementById(
        "supportButton"
    );


if (supportButton) {

    supportButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            showToast(
                "Раздел поддержки пока находится в разработке."
            );

        }
    );
}


// =========================================================
// INITIALIZATION
// =========================================================

ensureChatActionStyles();

loadChats();


if (chats.length) {

    chats.sort(
        (a, b) =>
            (b.updatedAt || b.createdAt || 0) -
            (a.updatedAt || a.createdAt || 0)
    );


    activeChatId =
        chats[0].id;
}


renderChatHistoryList();

renderChatHistory();

loadSubjects();