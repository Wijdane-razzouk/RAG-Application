import { chats, activeChatId, library, getActiveChat } from "./state.js";

// DOM ELEMENTS
export const elements = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    fileList: document.getElementById("file-list"),
    sendBtn: document.getElementById("send-btn"),
    userInput: document.getElementById("user-input"),
    chatMessages: document.getElementById("chat-messages"),
    chatTabs: document.getElementById("chat-tabs"),
    newChatBtn: document.getElementById("new-chat-btn"),
    navButtons: document.querySelectorAll(".nav-btn"),
    viewPanels: document.querySelectorAll(".view-panel"),
    addBtn: document.getElementById("add-btn"),
    clearBtn: document.getElementById("clear-all-btn"),
    genFlashBtn: document.getElementById("gen-flash-btn"),
    genQuizBtn: document.getElementById("gen-quiz-btn"),
    currentChatTitle: document.getElementById("current-chat-title"),
    flashcardGrid: document.getElementById("flashcards-grid"),
    flashcardSourcesList: document.getElementById("flashcard-sources-list"),
    quizContainer: document.getElementById("quiz-container"),
    quizSourcesList: document.getElementById("quiz-sources-list")
};

export function switchView(view) {
    elements.navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });
    elements.viewPanels.forEach(panel => {
        panel.classList.toggle("active", panel.id === `${view}-view`);
    });
    if (view === 'flashcards') renderFlashcardSources();
    if (view === 'quiz') renderQuizSources();
}

export function renderQuizSources() {
    if (!elements.quizSourcesList) return;
    elements.quizSourcesList.innerHTML = "";

    if (library.length === 0) {
        elements.quizSourcesList.innerHTML = '<p class="empty-list">No documents uploaded.</p>';
        return;
    }

    library.forEach(file => {
        const div = document.createElement("div");
        div.className = "source-item";
        div.innerHTML = `
      <label>
        <input type="checkbox" class="quiz-source-check" value="${file}" checked>
        <span>${file}</span>
      </label>
    `;
        elements.quizSourcesList.appendChild(div);
    });
}

export function renderQuiz(quizData) {
    const container = elements.quizContainer;
    container.innerHTML = "";

    if (!quizData || quizData.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No questions generated.</p></div>';
        return;
    }

    quizData.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "quiz-card";

        // Determine correct index from backend
        let correctIdx = item.correctIndex;
        // Fallback or safety check is already done in backend normalization
        if (correctIdx === undefined || correctIdx === -1) {
            // Should not happen with new filter, but good default
            correctIdx = 0;
        }

        const choicesHtml = item.choices.map((choice, i) => `
            <button class="quiz-choice" data-index="${i}">
                <span class="choice-letter">${String.fromCharCode(65 + i)}</span>
                <span class="choice-text">${choice}</span>
            </button>
        `).join("");

        card.innerHTML = `
            <div class="quiz-question">
                <span class="q-num">${index + 1}.</span>
                <p>${item.question}</p>
            </div>
            <div class="quiz-choices">
                ${choicesHtml}
            </div>
            <div class="quiz-feedback"></div>
        `;

        // Logic interaction
        const buttons = card.querySelectorAll(".quiz-choice");
        const feedback = card.querySelector(".quiz-feedback");

        buttons.forEach(btn => {
            btn.onclick = () => {
                // Remove previous states from this card only
                buttons.forEach(b => b.classList.remove("selected", "correct", "wrong"));

                const myIdx = parseInt(btn.dataset.index);
                const isCorrect = (myIdx === correctIdx);

                if (isCorrect) {
                    btn.classList.add("correct");
                    feedback.innerHTML = `<i class="ph-bold ph-check-circle"></i> Correct!`;
                    feedback.className = "quiz-feedback correct";
                } else {
                    btn.classList.add("wrong");
                    // Highlight the correct one if possible
                    if (correctIdx !== -1 && buttons[correctIdx]) {
                        buttons[correctIdx].classList.add("correct");
                    }

                    feedback.innerHTML = `<i class="ph-bold ph-x-circle"></i> Wrong. The correct answer was <strong>${item.answer}</strong>`;
                    feedback.className = "quiz-feedback wrong";
                }
            };
        });

        container.appendChild(card);
    });
}

export function renderTabs(onSwitch, onClose) {
    if (!elements.chatTabs) return;
    elements.chatTabs.innerHTML = "";
    chats.slice(-10).forEach(chat => {
        const tab = document.createElement("div");
        tab.className = `chat-tab ${chat.id === activeChatId ? "active" : ""}`;
        tab.innerHTML = `
      <i class="ph ph-chat-circle"></i>
      <span>${chat.name}</span>
      <button class="tab-close" title="Close"><i class="ph ph-x"></i></button>
    `;

        tab.onclick = (e) => {
            if (e.target.closest('.tab-close')) {
                onClose(chat.id);
                return;
            }
            onSwitch(chat.id);
        };
        elements.chatTabs.appendChild(tab);
    });
}

export function renderLibrary(onFileClick, onDeleteClick) {
    if (!elements.fileList) return;
    elements.fileList.innerHTML = "";
    library.forEach(file => {
        const li = document.createElement("li");
        li.innerHTML = `
      <i class="ph ph-file-pdf"></i>
      <span class="file-name text-truncate">${file}</span>
      <button class="delete-file" title="Delete"><i class="ph ph-trash"></i></button>
    `;

        li.querySelector('.file-name').onclick = () => onFileClick(file);
        li.querySelector('.delete-file').onclick = (e) => {
            e.stopPropagation();
            onDeleteClick(file);
        };

        elements.fileList.appendChild(li);
    });
}

export function renderFlashcardSources() {
    if (!elements.flashcardSourcesList) return;
    elements.flashcardSourcesList.innerHTML = "";

    if (library.length === 0) {
        elements.flashcardSourcesList.innerHTML = '<p class="empty-list">No documents uploaded.</p>';
        return;
    }

    library.forEach(file => {
        const div = document.createElement("div");
        div.className = "source-item";
        div.innerHTML = `
      <label>
        <input type="checkbox" class="flash-source-check" value="${file}" checked>
        <span>${file}</span>
      </label>
    `;
        elements.flashcardSourcesList.appendChild(div);
    });
}

export function renderMessage(text, type) {
    const div = document.createElement("div");
    div.className = `message ${type}-message`;
    div.innerHTML = `<p>${text}</p>`;
    elements.chatMessages.appendChild(div);
    scrollChat();
    return div;
}

export function scrollChat() {
    if (elements.chatMessages) elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

export function updateChatHeader(name) {
    if (elements.currentChatTitle) elements.currentChatTitle.textContent = name;
}

export function clearChatMessages() {
    if (elements.chatMessages) elements.chatMessages.innerHTML = "";
}
