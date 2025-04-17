let socket;
let username = '';
let isSearchingPartner = false;
let typingTimeout = null;
let hasPartner = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const statusElement = document.getElementById('status');

// Format timestamp
function formatTimestamp(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Clear chat messages
function clearChat() {
    while (messagesContainer.firstChild) {
        messagesContainer.removeChild(messagesContainer.firstChild);
    }
}

// Initialize socket connection
function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io(window.location.origin);

    socket.on('connect', () => {
        console.log('Connected to server');
        statusElement.textContent = '🔍 Looking for a partner...';
        hasPartner = false;
        isSearchingPartner = true;
    });

    socket.on('waiting', () => {
        statusElement.textContent = '🔍 Looking for a partner...';
        hasPartner = false;
        isSearchingPartner = true;
        addSystemMessage('🔍 Looking for a partner...');
    });

    socket.on('connected', (data) => {
        isSearchingPartner = false;
        hasPartner = true;
        statusElement.textContent = `Connected with ${data.partner}`;
        addSystemMessage(`🤝 Connected with ${data.partner}`);
    });

    socket.on('message', (data) => {
        if (hasPartner && !isSearchingPartner) {
            addMessage(data.text, false, new Date(data.timestamp));
        }
    });

    socket.on('partnerDisconnected', (data) => {
        hasPartner = false;
        if (!isSearchingPartner) {
            statusElement.textContent = '💔 Partner disconnected';
            addSystemMessage(`💔 ${data.message}`);
            addFindNewPartnerPrompt();
        }
    });

    socket.on('typing', () => {
        if (!isSearchingPartner && hasPartner) {
            statusElement.textContent = '✍️ Partner is typing...';
        }
    });

    socket.on('stopTyping', () => {
        if (!isSearchingPartner && hasPartner) {
            statusElement.textContent = 'Connected with Stranger';
        }
    });

    socket.on('disconnect', () => {
        hasPartner = false;
        isSearchingPartner = true;
        statusElement.textContent = '⚠️ Disconnected from server';
        addSystemMessage('⚠️ Disconnected from server. Please refresh the page.');
    });
}

// Add find new partner prompt
function addFindNewPartnerPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.classList.add('message', 'system', 'new-partner-prompt');
    
    const button = document.createElement('button');
    button.textContent = '🔄 Find New Partner';
    button.onclick = findNewPartner;
    button.classList.add('find-new-partner-button');
    
    promptDiv.appendChild(button);
    messagesContainer.appendChild(promptDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Join chat with username
function joinChat() {
    username = usernameInput.value.trim() || 'Stranger';
    initializeSocket();
    socket.emit('join', username);
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    clearChat();
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && hasPartner && !isSearchingPartner) {
        const timestamp = new Date();
        socket.emit('message', message, timestamp);
        addMessage(message, true, timestamp);
        messageInput.value = '';
        socket.emit('stopTyping');
        typingTimeout = null;
    }
}

// Handle typing
function handleTyping() {
    if (hasPartner && !isSearchingPartner) {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        } else {
            socket.emit('typing');
        }

        typingTimeout = setTimeout(() => {
            socket.emit('stopTyping');
            typingTimeout = null;
        }, 1000);
    }
}

// Find new chat partner
function findNewPartner() {
    if (!isSearchingPartner) {
        isSearchingPartner = true;
        hasPartner = false;
        clearChat();
        socket.emit('findNewPartner');
        statusElement.textContent = '🔍 Finding new partner...';
        addSystemMessage('🔍 Looking for a new partner...');
    }
}

// Add message to chat
function addMessage(text, isSent, timestamp = new Date()) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isSent ? 'sent' : 'received');
    
    const messageText = document.createElement('div');
    messageText.textContent = text;
    messageDiv.appendChild(messageText);
    
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.textContent = formatTimestamp(timestamp);
    messageDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add system message
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'system');
    
    const messageText = document.createElement('div');
    messageText.textContent = text;
    messageDiv.appendChild(messageText);
    
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.textContent = formatTimestamp(new Date());
    messageDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle enter key in message input
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Handle typing events
messageInput.addEventListener('input', handleTyping);

// Handle enter key in username input
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinChat();
    }
}); 