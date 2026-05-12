// websocket/ioWS.js
const WebSocket = require('ws');
const { PORT_IO_WS } = require('../config/constants');

const ioWss = new WebSocket.Server({ port: PORT_IO_WS });

function isValidCloseCode(code) {
  return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
}

// Función para enviar solicitud de proyección automática
function sendAutoProjectionRequest() {
  console.log('🚀 Enviando solicitud de proyección automática a clientes...');
  
  let clientCount = 0;
  ioWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      clientCount++;
      try {
        client.send(JSON.stringify({
          type: 'auto-project-startup',
          timestamp: new Date().toISOString(),
          message: 'Iniciar proyección automática'
        }));
        console.log(`✅ Mensaje enviado a cliente ${clientCount}`);
      } catch (err) {
        console.error('Error enviando mensaje a cliente:', err);
      }
    }
  });
  
  console.log(`✅ Solicitud enviada a ${clientCount} clientes`);
}

ioWss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket connection established from', req.socket.remoteAddress);

  ws.on('message', (message, isBinary) => {
    try {
      const msgString = isBinary ? message.toString() : (typeof message === 'string' ? message : message.toString());
      console.log('📨 received message:', msgString);

      // PROCESAR MENSAJE DE AUTO-PROYECCIÓN
      if (msgString.includes('auto-project-startup')) {
        console.log('🔄 Mensaje auto-project-startup recibido, reenviando a todos los clientes...');
        
        // Reenviar a TODOS los clientes
        ioWss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(msgString);
              console.log('✅ Mensaje reenviado a cliente');
            } catch (sendErr) {
              console.error('Error reenviando mensaje:', sendErr);
            }
          }
        });
        return;
      }

      // Manejar otros tipos de mensajes
      if (msgString.startsWith('font-size:')) {
        const newSize = msgString.split(':')[1].trim();
        console.log(`Nuevo tamaño de fuente: ${newSize}`);
        
        // Reenviar a otros clientes (proyectores)
        ioWss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            try {
              client.send(msgString);
            } catch (sendErr) {
              console.error('Error sending to client:', sendErr);
            }
          }
        });
      }
      
    } catch (err) {
      console.error('Error procesando mensaje:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket closed. code=${code}, reason=${reason && reason.toString ? reason.toString() : reason}`);
    if (!isValidCloseCode(code)) {
      console.warn('Recibido código de cierre inválido:', code);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

module.exports = { ioWss, sendAutoProjectionRequest };
