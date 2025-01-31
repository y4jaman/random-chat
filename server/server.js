const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3001;

// Create an Express app to serve the React frontend
const app = express();

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

let waitingUsers = [];
let pairs = new Map();

function findPartner(ws) {
  waitingUsers = waitingUsers.filter(user => user.readyState === WebSocket.OPEN);

  if (waitingUsers.length > 0) {
    const partner = waitingUsers.shift();
    pairs.set(ws, partner);
    pairs.set(partner, ws);

    ws.send(JSON.stringify({ type: 'partner_found' }));
    partner.send(JSON.stringify({ type: 'partner_found' }));
  } else {
    waitingUsers.push(ws);
    ws.send(JSON.stringify({ type: 'searching' }));
  }
}

wss.on('connection', (ws) => {
  findPartner(ws);

  ws.on('message', (message) => {
    try {
      if (message instanceof Buffer) {
        message = message.toString();
      }
      const data = JSON.parse(message);

      if (data.type === 'skip') {
        const partner = pairs.get(ws);
        if (partner && data.sendDisconnect) {
          partner.send(JSON.stringify({ type: 'partner_skipped' }));
        }
        pairs.delete(partner);
        pairs.delete(ws);
        if (!data.sendDisconnect) {
          findPartner(ws);
        }
      } else if (data.type === 'message') {
        const partner = pairs.get(ws);
        if (partner && partner.readyState === WebSocket.OPEN) {
          partner.send(JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
          }));
        }
      } else if (data.type === 'typing') {
        const partner = pairs.get(ws);
        if (partner && partner.readyState === WebSocket.OPEN) {
          partner.send(JSON.stringify({
            type: 'typing',
            isTyping: data.isTyping
          }));
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    const partner = pairs.get(ws);
    if (partner) {
      partner.send(JSON.stringify({ type: 'partner_disconnected' }));
      pairs.delete(partner);
      pairs.delete(ws);
    }
    waitingUsers = waitingUsers.filter(u => u !== ws);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});