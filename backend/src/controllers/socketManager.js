import { Server } from "socket.io";

let connections = {}
let messages = {}
let timeOnline = {}

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
        console.log("Something Connected")

        // UPDATED: Accept userName as the second argument
        socket.on("join-call", (path, userName) => {
            if (connections[path] === undefined) {
                connections[path] = [];
            }
            
            // UPDATED: Store object with ID and Username
            connections[path].push({ id: socket.id, username: userName });

            timeOnline[socket.id] = new Date();

            // Notify everyone in the room
            // We send the full list of clients (with names) to everyone
            connections[path].forEach(client => {
                io.to(client.id).emit("user-joined", socket.id, connections[path]);
            });

            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
                }
            }
        })

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("chat-message", (data, sender) => {
            // Helper to find the matching room
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
                console.log("message", matchingRoom, ":", sender, data)

                connections[matchingRoom].forEach((client) => {
                    io.to(client.id).emit("chat-message", data, sender, socket.id);
                })
            }
        })

        socket.on("disconnect", () => {
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())
            var key

            for (const [k, v] of Object.entries(connections)) {
                // Check if the disconnected socket is in this room
                const index = v.findIndex(client => client.id === socket.id);
                
                if (index !== -1) {
                    key = k;
                    // Remove user from room
                    connections[key].splice(index, 1);

                    // Notify others
                    connections[key].forEach(client => {
                        io.to(client.id).emit("user-left", socket.id);
                    });

                    if (connections[key].length === 0) {
                        delete connections[key];
                    }
                }
            }
        })
    })

    return io;
}