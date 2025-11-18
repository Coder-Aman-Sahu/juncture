import { Server } from "socket.io";

let connections = {}
let messages = {}
let timeOnline = {}
let roomAdmins = {} // Track the admin (host) for each room
let waitingQueue = {} // Track users waiting to be admitted

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("Something Connected: " + socket.id)

        socket.on("join-call", (path, userName) => {
            // Initialize room structures if they don't exist
            if (connections[path] === undefined) {
                connections[path] = [];
                roomAdmins[path] = socket.id; // First joiner becomes Admin
            }
            if (waitingQueue[path] === undefined) {
                waitingQueue[path] = [];
            }

            // CHECK: Is this the admin or a guest?
            // If room has an admin and this is NOT the admin, put them in waiting room
            if (roomAdmins[path] && socket.id !== roomAdmins[path]) {
                // Add to waiting queue
                const userObj = { id: socket.id, username: userName };
                waitingQueue[path].push(userObj);

                // Notify Admin
                io.to(roomAdmins[path]).emit("user-waiting", waitingQueue[path]);
                
                // Notify the user they are waiting
                io.to(socket.id).emit("wait-for-admin");
            } else {
                // Join Immediately (First user or Admin re-joining logic)
                joinRoom(socket, path, userName);
            }
        });

        // ADMIN ACTION: Admit a user
        socket.on("admit-user", ({ roomPath, socketId }) => {
            if (roomAdmins[roomPath] !== socket.id) return; // Security check

            // Find user in waiting queue
            const index = waitingQueue[roomPath]?.findIndex(u => u.id === socketId);
            if (index !== -1) {
                const userToAdmit = waitingQueue[roomPath][index];
                
                // Remove from queue
                waitingQueue[roomPath].splice(index, 1);
                
                // Perform the actual join logic for that user
                joinRoom(io.sockets.sockets.get(socketId), roomPath, userToAdmit.username);
                
                // Update Admin's waiting list view
                io.to(socket.id).emit("user-waiting", waitingQueue[roomPath]);
            }
        });

        // ADMIN ACTION: Reject a user
        socket.on("reject-user", ({ roomPath, socketId }) => {
             if (roomAdmins[roomPath] !== socket.id) return;

             const index = waitingQueue[roomPath]?.findIndex(u => u.id === socketId);
             if (index !== -1) {
                 waitingQueue[roomPath].splice(index, 1);
                 
                 // Notify the user they were rejected
                 io.to(socketId).emit("entry-rejected");

                 // Update Admin's waiting list
                 io.to(socket.id).emit("user-waiting", waitingQueue[roomPath]);
             }
        });

        // FEATURE: Hand Raise
        socket.on("toggle-hand", (path, isRaised) => {
            if(connections[path]) {
                connections[path].forEach(client => {
                    io.to(client.id).emit("hand-update", socket.id, isRaised);
                });
            }
        });

        // FEATURE: Mute Status
        socket.on("toggle-mute-status", (path, isMuted) => {
            if(connections[path]) {
                connections[path].forEach(client => {
                    io.to(client.id).emit("mute-update", socket.id, isMuted);
                });
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.some(client => client.id === socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                }, ['', false]);

            if (found) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }
                messages[matchingRoom].push({ 'sender': sender, 'data': data, 'socket-id-sender': socket.id });

                connections[matchingRoom].forEach((client) => {
                    io.to(client.id).emit("chat-message", data, sender, socket.id);
                })
            }
        })

        socket.on("disconnect", () => {
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())
            var key

            for (const [k, v] of Object.entries(connections)) {
                const index = v.findIndex(client => client.id === socket.id);
                
                if (index !== -1) {
                    key = k;
                    connections[key].splice(index, 1);
                    timeOnline[socket.id] = undefined;

                    connections[key].forEach(client => {
                        io.to(client.id).emit("user-left", socket.id);
                    });

                    if (roomAdmins[key] === socket.id) {
                        if (connections[key].length > 0) {
                            roomAdmins[key] = connections[key][0].id;
                            io.to(roomAdmins[key]).emit("you-are-admin"); 
                        } else {
                            delete roomAdmins[key];
                            delete waitingQueue[key];
                        }
                    }

                    if (connections[key].length === 0) {
                        delete connections[key];
                    }
                }
            }
        })
    });

    const joinRoom = (socket, path, userName) => {
        if (!socket) return; 

        connections[path].push({ id: socket.id, username: userName });
        timeOnline[socket.id] = new Date();

        if (roomAdmins[path] === socket.id) {
            io.to(socket.id).emit("you-are-admin");
        }

        connections[path].forEach(client => {
            io.to(client.id).emit("user-joined", socket.id, connections[path]);
        });

        if (messages[path] !== undefined) {
            for (let a = 0; a < messages[path].length; ++a) {
                io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                    messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
            }
        }
        
        io.to(socket.id).emit("entry-accepted");
    };

    return io;
}