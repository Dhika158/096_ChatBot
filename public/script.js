const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const chatMessages = document.querySelector("#chatMessages");
const sendButton = document.querySelector("#sendButton");

const messages = [];

function addMessage(content, className) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", className);
    messageElement.textContent = content;
    chatMessages.append(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageElement;
}

function resizeInput() {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
}

async function readChatStream(response, assistantMessage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.startsWith("data:")) {
                continue;
            }

            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") {
                continue;
            }

            assistantMessage.textContent += JSON.parse(data);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        if (done) {
            break;
        }
    }
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = messageInput.value.trim();
    if (!content || sendButton.disabled) {
        return;
    }

    addMessage(content, "message-user");
    messages.push({ role: "user", content });
    messageInput.value = "";
    resizeInput();
    sendButton.disabled = true;

    const assistantMessage = addMessage("Sedang mengetik...", "message-assistant");
    assistantMessage.classList.add("message-typing");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || "Pesan tidak dapat dikirim.");
        }

        if (!response.body) {
            throw new Error("Browser tidak mendukung streaming jawaban.");
        }

        assistantMessage.textContent = "";
        assistantMessage.classList.remove("message-typing");
        await readChatStream(response, assistantMessage);

        if (assistantMessage.textContent) {
            messages.push({ role: "assistant", content: assistantMessage.textContent });
        } else {
            assistantMessage.textContent = "Maaf, saya belum menerima jawaban.";
        }
    } catch (error) {
        assistantMessage.classList.remove("message-typing");
        assistantMessage.classList.add("message-error");
        assistantMessage.textContent = error.message || "Terjadi kesalahan saat menghubungi chatbot.";
        messages.pop();
    } finally {
        sendButton.disabled = false;
        messageInput.focus();
    }
});

messageInput.addEventListener("input", resizeInput);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});