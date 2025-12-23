import { isAIProcessing, getActiveChat, saveState, library, setLibrary, chats, setChats, activeChatId, setActiveChatId } from "./state.js";
import { renderMessage, scrollChat, elements } from "./ui.js";

export async function uploadPDFs(files, callbacks) {
    const formData = new FormData();
    files.slice(0, 3).forEach(f => formData.append("pdfs", f));

    callbacks.onSystemMessage("Connecting to library...");

    try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const data = await res.json();
        if (data.ok) {
            files.forEach(f => {
                if (!library.includes(f.name)) library.push(f.name);
            });
            saveState();
            callbacks.onSuccess();
            callbacks.onAIMessage("Library updated. Select a document to start a focused chat.");
        }
    } catch (error) {
        callbacks.onSystemMessage("Connection failed. Check server logs.");
    }
}

export async function deleteLibraryFile(filename, callbacks) {
    if (!confirm(`Remove ${filename}?`)) return;
    try {
        const res = await fetch("/api/delete-source", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: filename })
        });
        if ((await res.json()).ok) {
            const newLibrary = library.filter(f => f !== filename);
            setLibrary(newLibrary);

            const newChats = chats.filter(c => c.source !== filename);
            setChats(newChats);

            if (getActiveChat().source === filename) setActiveChatId(newChats[0].id);

            saveState();
            callbacks.onSuccess();
        }
    } catch (e) { }
}

export async function streamAsk(question, lang = "fr") {
    if (isAIProcessing.value) return;
    isAIProcessing.value = true;

    const chat = getActiveChat();
    chat.messages.push({ type: "user", text: question });
    renderMessage(question, "user");

    const aiDiv = document.createElement("div");
    aiDiv.className = "message ai-message";
    aiDiv.innerHTML = `<p class="thinking">Analyzing...</p>`;
    elements.chatMessages.appendChild(aiDiv);
    scrollChat();

    const p = aiDiv.querySelector("p");
    let fullRaw = "";

    try {
        const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, lang, source: chat.source }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        p.classList.remove("thinking");
        p.textContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value).split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = JSON.parse(line.slice(6));
                    if (data.token) {
                        fullRaw += data.token;
                        p.textContent = fullRaw;
                        scrollChat();
                    } else if (data.done) {
                        chat.messages.push({ type: "ai", text: fullRaw });
                        saveState();
                    }
                }
            }
        }
    } catch (e) {
        p.textContent = "Error: Check connection.";
    } finally {
        isAIProcessing.value = false;
    }
}

export async function generateFlashcards() {
    if (isAIProcessing.value) return;
    isAIProcessing.value = true;

    const grid = elements.flashcardGrid;
    const genBtn = elements.genFlashBtn;

    const selectedSources = [...document.querySelectorAll(".flash-source-check:checked")].map(el => el.value);

    if (selectedSources.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>Please select at least one document.</p></div>';
        isAIProcessing.value = false;
        return;
    }

    if (genBtn) genBtn.disabled = true;
    grid.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div> Creating contextual cards...</div>';

    try {
        const res = await fetch("/api/flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "key concepts", source: selectedSources })
        });
        const cards = await res.json();
        grid.innerHTML = "";

        if (!cards || cards.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>No flashcards could be generated from these documents. Try picking different ones!</p></div>';
            return;
        }

        cards.forEach(c => {
            if (!c.question || !c.answer) return;
            const cardEl = document.createElement("div");
            cardEl.className = "flashcard-zen";
            cardEl.innerHTML = `
        <div class="card-inner">
          <div class="card-front"><span>Question</span><p>${c.question}</p></div>
          <div class="card-back"><span>Answer</span><p>${c.answer}</p></div>
        </div>
      `;
            cardEl.onclick = () => cardEl.classList.toggle("flipped");
            grid.appendChild(cardEl);
        });
    } catch (e) {
        grid.innerHTML = '<p class="error">Generation failed.</p>';
    } finally {
        isAIProcessing.value = false;
        if (genBtn) genBtn.disabled = false;
    }
}

export async function generateQuiz() {
    if (isAIProcessing.value) return;
    isAIProcessing.value = true;

    const container = elements.quizContainer;
    const genBtn = elements.genQuizBtn;

    const selectedSources = [...document.querySelectorAll(".quiz-source-check:checked")].map(el => el.value);

    if (selectedSources.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Please select at least one document.</p></div>';
        isAIProcessing.value = false;
        return;
    }

    if (selectedSources.length > 3) {
        container.innerHTML = '<div class="empty-state"><p>Please select max 3 documents.</p></div>';
        isAIProcessing.value = false;
        return;
    }

    if (genBtn) genBtn.disabled = true;
    container.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div> Generating quiz...</div>';

    try {
        const res = await fetch("/api/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "key concepts", source: selectedSources })
        });
        const quizData = await res.json();

        // Import renderQuiz dynamically or assume it's available via module scope if we refactor imports?
        // Wait, app.js imports renderQuiz from ui.js? No, api.js imports from ui.js.
        // I need to add renderQuiz to the imports in api.js

        const { renderQuiz } = await import("./ui.js");
        renderQuiz(quizData);

    } catch (e) {
        container.innerHTML = '<p class="error">Generation failed.</p>';
    } finally {
        isAIProcessing.value = false;
        if (genBtn) genBtn.disabled = false;
    }
}
