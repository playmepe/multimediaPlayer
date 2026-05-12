// websocket/bibliaWS.js
const WebSocket = require('ws');
const { PORT_BIBLIA_WS } = require('../config/constants');

const bibliaWss = new WebSocket.Server({ port: PORT_BIBLIA_WS });

function isValidCloseCode(code) {
  return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
}

bibliaWss.on('connection', (ws, req) => {
  console.log('Biblia WebSocket connection established from', req.socket.remoteAddress);

  ws.on('message', (message, isBinary) => {
    try {
      const msgString = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
      
      // Reenviar a otros clientes (texto)
      bibliaWss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try {
            client.send(msgString);
          } catch (sendErr) {
            console.error('Error sending to client in bibliaWss:', sendErr);
          }
        }
      });

      if (msgString.startsWith('font-size:')) {
        const newSize = msgString.split(':')[1].trim();
        console.log(`Nuevo tamaño de fuente: ${newSize}`);
      }
    } catch (err) {
      console.error('Error procesando mensaje en bibliaWss:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Biblia WS closed. code=${code}, reason=${reason && reason.toString ? reason.toString() : reason}`);
    if (!isValidCloseCode(code)) {
      console.warn('Biblia WS: recibido código de cierre inválido:', code);
    }
  });

  ws.on('error', (err) => {
    console.error('Biblia WS error:', err);
  });
});

console.log(`Biblia WebSocket server is running on ws://localhost:${PORT_BIBLIA_WS}`);

module.exports = { bibliaWss };
