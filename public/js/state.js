// APP STATE
export let chats = JSON.parse(localStorage.getItem('mynote_chats')) || [
    { id: "general", name: "General Chat", source: null, messages: [] }
];
export let activeChatId = localStorage.getItem('mynote_active_chat') || "general";
export let library = JSON.parse(localStorage.getItem('mynote_library')) || [];
export let isAIProcessing = { value: false }; // Use object for shared reference

export function saveState() {
    localStorage.setItem('mynote_chats', JSON.stringify(chats));
    localStorage.setItem('mynote_library', JSON.stringify(library));
    localStorage.setItem('mynote_active_chat', activeChatId);
}

export function setActiveChatId(id) {
    activeChatId = id;
}

export function setLibrary(newLibrary) {
    library = newLibrary;
}

export function setChats(newChats) {
    chats = newChats;
}

export function getActiveChat() {
    return chats.find(c => c.id === activeChatId) || chats[0];
}
