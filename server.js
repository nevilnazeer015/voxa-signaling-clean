import { WebSocketServer } from 'ws';
import http from 'http';

const port = process.env.PORT || 3001;
const server = http.createServer();
const wss = new WebSocketServer({ server });

const waitingQueue = {};  // { language: [ws, ws] }
const peers = new Map();  // ws1 <-> ws2

wss.on('connection', (ws) => {
  let currentLang = null;

  ws.on('message', (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg);
    } catch (e) {
      return;
    }

    const { type, data } = payload;

    if (type === 'join') {
      currentLang = data.language;
      if (!waitingQueue[currentLang]) waitingQueue[currentLang] = [];

      if (!waitingQueue[currentLang].includes(ws)) {
        waitingQueue[currentLang].push(ws);
        tryMatch(currentLang);
      }
    }

    if (type === 'signal' && data && data.signal) {
      const peer = peers.get(ws);
      if (peer) {
        peer.send(JSON.stringify({ type: 'signal', data: { signal: data.signal } }));
      }
    }

    if (type === 'end-call') {
      const peer = peers.get(ws);
      if (peer) {
        peer.send(JSON.stringify({ type: 'peer-disconnected' }));
        peers.delete(peer);
        peers.delete(ws);
      }
    }
  });

  ws.on('close', () => {
    if (currentLang && waitingQueue[currentLang]) {
      waitingQueue[currentLang] = waitingQueue[currentLang].filter(client => client !== ws);
    }

    const peer = peers.get(ws);
    if (peer) {
      peer.send(JSON.stringify({ type: 'peer-disconnected' }));
      peers.delete(peer);
      peers.delete(ws);
    }
  });
});

function tryMatch(language) {
  const queue = waitingQueue[language];
  while (queue.length >= 2) {
    const ws1 = queue.shift();
    const ws2 = queue.shift();

    peers.set(ws1, ws2);
    peers.set(ws2, ws1);

    ws1.send(JSON.stringify({ type: 'match', data: { initiator: true } }));
    ws2.send(JSON.stringify({ type: 'match', data: { initiator: false } }));
  }
}

server.listen(port, () => {
  console.log(`✅ Signaling server running on port ${port}`);
});
