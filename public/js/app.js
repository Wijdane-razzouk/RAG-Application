import { elements, renderTabs, renderLibrary, switchView, renderMessage, updateChatHeader, clearChatMessages, scrollChat } from "./ui.js";
import { chats, activeChatId, library, saveState, setActiveChatId, getActiveChat, isAIProcessing } from "./state.js";
import { uploadPDFs, deleteLibraryFile, streamAsk, generateFlashcards, generateQuiz } from "./api.js";

function init() {
    renderLibrary(onFileClick, onDeleteClick);
    renderTabs(switchChat, closeChat);

    const currentChat = chats.find(c => c.id === activeChatId) || chats[0];
    switchChat(currentChat.id);

    setupListeners();
    switchView('chat');
}

function setupListeners() {
    elements.navButtons.forEach(btn => {
        btn.onclick = () => switchView(btn.dataset.view);
    });

    if (elements.addBtn) elements.addBtn.onclick = () => elements.fileInput.click();
    if (elements.genFlashBtn) elements.genFlashBtn.onclick = generateFlashcards;
    if (elements.genQuizBtn) elements.genQuizBtn.onclick = generateQuiz;

    if (elements.clearBtn) {
        elements.clearBtn.onclick = () => {
            if (confirm("Clear all chats and history? This cannot be undone.")) {
                localStorage.clear();
                location.reload();
            }
        };
    }

    if (elements.sendBtn) elements.sendBtn.onclick = handleSend;
    if (elements.userInput) {
        elements.userInput.onkeypress = (e) => {
            if (e.key === "Enter") handleSend();
        };
    }

    if (elements.newChatBtn) {
        elements.newChatBtn.onclick = () => createChat("New Session");
    }

    // File drop/upload
    if (elements.dropZone) {
        elements.dropZone.onclick = () => elements.fileInput.click();
        elements.dropZone.ondragover = (e) => { e.preventDefault(); elements.dropZone.classList.add("drag-over"); };
        elements.dropZone.ondragleave = () => elements.dropZone.classList.remove("drag-over");
        elements.dropZone.ondrop = (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove("drag-over");
            const files = [...e.dataTransfer.files].filter(f => f.type === "application/pdf");
            if (files.length) handleUpload(files);
        };
    }
    if (elements.fileInput) {
        elements.fileInput.onchange = () => {
            const files = [...elements.fileInput.files];
            if (files.length) handleUpload(files);
        };
    }
}

function switchChat(id) {
    const chat = chats.find(c => c.id === id) || chats[0];
    setActiveChatId(chat.id);
    saveState();

    updateChatHeader(chat.name);
    clearChatMessages();
    chat.messages.forEach(msg => {
        renderMessage(msg.text, msg.type);
    });

    renderTabs(switchChat, closeChat);
    scrollChat();
}

function createChat(name, source = null) {
    const id = Date.now().toString();
    chats.push({ id, name, source, messages: [] });
    saveState();
    renderTabs(switchChat, closeChat);
    switchChat(id);
    switchView('chat');
    return id;
}

function closeChat(id) {
    if (chats.length <= 1) return;
    const newChats = chats.filter(c => c.id !== id);
    // We need to update the chats array in state. Since it's a live binding/exported variable, 
    // we might need a setter if we reassign. But here we can't reassign easily if it's an export.
    // Actually, chats is exported as a live binding. Reassigning it in app.js won't work if it's defined with 'let' in state.js and exported.
    // I added setChats in state.js.

    // Actually, I'll just use splice to keep the reference or use the setter.
    chats.length = 0;
    newChats.forEach(c => chats.push(c));

    if (activeChatId === id) setActiveChatId(chats[0].id);
    saveState();
    renderTabs(switchChat, closeChat);
    switchChat(activeChatId);
}

function onFileClick(file) {
    let chat = chats.find(c => c.source === file);
    if (!chat) createChat(file, file);
    else switchChat(chat.id);
    switchView('chat');
}

async function onDeleteClick(file) {
    await deleteLibraryFile(file, {
        onSuccess: () => {
            renderLibrary(onFileClick, onDeleteClick);
            renderTabs(switchChat, closeChat);
            switchChat(activeChatId);
        }
    });
}

function handleSend() {
    const question = elements.userInput.value.trim();
    if (!question) return;
    elements.userInput.value = "";
    streamAsk(question);
}

function handleUpload(files) {
    uploadPDFs(files, {
        onSystemMessage: (txt) => renderMessage(txt, "system"),
        onAIMessage: (txt) => {
            const chat = getActiveChat();
            chat.messages.push({ type: "ai", text: txt });
            renderMessage(txt, "ai");
            saveState();
        },
        onSuccess: () => {
            renderLibrary(onFileClick, onDeleteClick);
        }
    });
}

init();
