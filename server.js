const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server);

const users = new Map(); // socketId -> {username, partnerId}
const waitingUsers = []; // array of socket IDs

function findPartner(socket, username) {
    if (waitingUsers.length > 0) {
        const partnerId = waitingUsers.shift();
        const partner = users.get(partnerId);
        
        if (partner) {
            // Connect both users
            users.set(socket.id, { username, partnerId });
            users.set(partnerId, { ...partner, partnerId: socket.id });
            
            // Notify both users
            socket.emit('connected', { partner: partner.username });
            io.to(partnerId).emit('connected', { partner: username });
            return true;
        }
    }
    return false;
}

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('join', (username) => {
        // Store user
        users.set(socket.id, { username, partnerId: null });
        
        // Try to find a partner
        if (!findPartner(socket, username)) {
            waitingUsers.push(socket.id);
            socket.emit('waiting');
        }
    });

    socket.on('message', (message, timestamp) => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
            socket.to(user.partnerId).emit('message', {
                text: message,
                sender: user.username,
                timestamp
            });
        }
    });

    socket.on('typing', () => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
            socket.to(user.partnerId).emit('typing');
        }
    });

    socket.on('stopTyping', () => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
            socket.to(user.partnerId).emit('stopTyping');
        }
    });

    socket.on('findNewPartner', () => {
        const user = users.get(socket.id);
        if (user) {
            // Notify old partner if exists
            if (user.partnerId) {
                const partner = users.get(user.partnerId);
                if (partner) {
                    io.to(user.partnerId).emit('partnerDisconnected', {
                        message: `${user.username} has left the chat`
                    });
                    users.set(user.partnerId, { ...partner, partnerId: null });
                }
            }
            
            // Try to find new partner
            if (!findPartner(socket, user.username)) {
                waitingUsers.push(socket.id);
                users.set(socket.id, { ...user, partnerId: null });
                socket.emit('waiting');
            }
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // Remove from waiting list if present
            const waitingIndex = waitingUsers.indexOf(socket.id);
            if (waitingIndex !== -1) {
                waitingUsers.splice(waitingIndex, 1);
            }

            // Notify partner if exists
            if (user.partnerId) {
                const partner = users.get(user.partnerId);
                if (partner) {
                    io.to(user.partnerId).emit('partnerDisconnected', {
                        message: `${user.username} has disconnected`
                    });
                    users.set(user.partnerId, { ...partner, partnerId: null });
                }
            }

            // Remove user
            users.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 