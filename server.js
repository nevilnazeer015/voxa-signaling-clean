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

    if (type === 'signal' && data && data.to) {
      data.to.send(JSON.stringify({ type: 'signal', data: { signal: data.signal } }));
    }

    if (type === 'end-call') {
      const peer = peers.get(ws);
      if (peer
