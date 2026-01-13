const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Enable CORS
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let sshClient = new Client();

    socket.on('ssh-connect', (config) => {
        console.log(`Attempting to connect to ${config.host}:${config.port} as ${config.username}`);
        
        try {
            sshClient.on('ready', () => {
                console.log('SSH Connection Ready');
                socket.emit('ssh-ready');

                sshClient.shell((err, stream) => {
                    if (err) {
                        console.error('SSH Shell Error:', err);
                        socket.emit('ssh-error', err.message);
                        return;
                    }

                    // Handle data from SSH stream
                    stream.on('data', (data) => {
                        socket.emit('ssh-data', data.toString('utf-8'));
                    });

                    stream.on('close', () => {
                        console.log('SSH Stream Closed');
                        socket.emit('ssh-close');
                        sshClient.end();
                    });

                    // Handle data from client to SSH
                    socket.on('client-data', (data) => {
                        stream.write(data);
                    });
                    
                    // Handle resize
                    socket.on('resize', (data) => {
                         stream.setWindow(data.rows, data.cols, data.height, data.width);
                    });
                });
            }).on('error', (err) => {
                console.error('SSH Client Error:', err);
                socket.emit('ssh-error', err.message);
            }).on('close', () => {
                console.log('SSH Connection Closed');
                socket.emit('ssh-close');
            }).connect({
                host: config.host,
                port: parseInt(config.port) || 22,
                username: config.username,
                password: config.password
            });
        } catch (error) {
            console.error('Connection setup error:', error);
            socket.emit('ssh-error', error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (sshClient) {
            sshClient.end();
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`SSH Web Client running at http://localhost:${PORT}`);
});
