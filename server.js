const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

const apiKey = process.env.GEMINI_API_KEY?.trim();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/subjects", (req, res) => {
    res.json([
        { icon: "∑", name: "Математика", progress: 72 },
        { icon: "⚛", name: "Физика", progress: 48 },
        { icon: "⌘", name: "Информатика", progress: 85 },
        { icon: "A", name: "Английский", progress: 37 }
    ]);
});

app.post("/api/chat", (req, res) => {
    const message = req.body?.message;
    const history = req.body?.history;

    if (typeof message !== "string" || !message.trim()) {
        return res.status(400).send("Пустое сообщение.");
    }

    if (!ai) {
        return res.status(500).send(
            "GEMINI_API_KEY не найден. Проверь переменную окружения."
        );
    }

    const safeHistory = Array.isArray(history)
        ? history
            .filter(item =>
                item &&
                (item.role === "user" || item.role === "model") &&
                Array.isArray(item.parts)
            )
            .slice(-40)
        : [];

    const contents = [
        ...safeHistory,
        {
            role: "user",
            parts: [{ text: message.trim() }]
        }
    ];

    const systemInstruction = `
Ты — EduAI, учебный AI-помощник.

Помогай пользователю с учебными задачами и учебными темами.

Основные направления:
математика, физика, химия, информатика, русский язык,
литература, история, обществознание, английский язык
и другие школьные и образовательные предметы.

Отвечай понятно, структурированно и по делу.

Используй Markdown:
**жирный**
заголовки
списки
нумерацию
блоки кода при необходимости.

Формулы записывай в LaTeX.

Можно умеренно использовать подходящие эмодзи:
📚 💡 ✅ 🔹 🧠 📌 ⚠️

Не используй бессмысленные символы, ASCII-рамки и чрезмерное
количество специальных символов.

Учитывай предыдущие сообщения из истории текущего чата.

Если вопрос не относится к учебе, вежливо объясни, что EduAI
предназначен прежде всего для учебной помощи.

Не выдумывай факты. Если информации недостаточно или ты
не уверен, честно скажи об этом.
`.trim();

    const request = {
        model: "gemini-3.8-flash",
        contents,
        config: {
            systemInstruction
        }
    };

    const maxAttempts = 4;

    const generate = (attempt) => {
        console.log(`Gemini: попытка ${attempt}/${maxAttempts}`);

        return ai.models.generateContent(request)
            .then(response => {
                const answer =
                    typeof response.text === "string"
                        ? response.text.trim()
                        : "";

                if (!answer) {
                    throw new Error("Gemini вернул пустой ответ.");
                }

                res.status(200);
                res.setHeader(
                    "Content-Type",
                    "text/plain; charset=utf-8"
                );
                res.setHeader(
                    "Cache-Control",
                    "no-cache, no-transform"
                );

                res.send(answer);
            })
            .catch(error => {
                console.error(`Gemini error ${attempt}:`, error);

                const errorText = String(
                    error?.message || error
                ).toLowerCase();

                const temporaryError =
                    errorText.includes("503") ||
                    errorText.includes("unavailable") ||
                    errorText.includes("timeout") ||
                    errorText.includes("timed out") ||
                    errorText.includes("fetch failed") ||
                    errorText.includes("und_err");

                if (temporaryError && attempt < maxAttempts) {
                    const delay = Math.min(
                        1000 * Math.pow(2, attempt - 1),
                        8000
                    );

                    console.log(`Повтор через ${delay} мс...`);

                    return new Promise(resolve => {
                        setTimeout(resolve, delay);
                    }).then(() => generate(attempt + 1));
                }

                if (!res.headersSent) {
                    res.status(500).send(
                        error?.message ||
                        "Ошибка при обращении к Gemini."
                    );
                }
            });
    };

    generate(1);
});

app.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log(`EduAI запущен: http://localhost:${PORT}`);

    if (apiKey) {
        console.log("Gemini API: ключ найден");
    } else {
        console.log("Gemini API: КЛЮЧ НЕ НАЙДЕН");
    }

    console.log("=================================");
    console.log("");
});
