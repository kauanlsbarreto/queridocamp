// f:\sitequeridocamp\backend\server.js

require('dotenv').config();
const { Rcon } = require('rcon-client');
const { Server } = require('socket.io');
const dgram = require('dgram');
const http = require('http');

const RCON_HOST = process.env.CS2_IP || '217.196.63.100';
const RCON_PORT = parseInt(process.env.CS2_PORT || '27015');
const RCON_PASSWORD = process.env.CS2_PASSWORD || '5d0091b9086d44dab92b64e7b15b29b7';
const SOCKET_PORT = 3001; 
const UDP_LOG_PORT = 3002; 

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let rcon = null;

async function connectRcon() {
  try {
    if (rcon && rcon.authenticated) return;

    console.log('Tentando conectar ao RCON...');
    rcon = new Rcon({
      host: RCON_HOST,
      port: RCON_PORT,
      password: RCON_PASSWORD
    });

    rcon.on('error', (err) => {
      console.error('Erro RCON:', err);
      io.emit('console:output', `\n[SISTEMA] Erro na conexão RCON: ${err.message}`);
      setTimeout(connectRcon, 5000);
    });

    rcon.on('end', () => {
      console.log('Conexão RCON fechada');
      io.emit('console:output', '\n[SISTEMA] Conexão RCON fechada. Reconectando...');
      setTimeout(connectRcon, 5000);
    });

    await rcon.connect();
    console.log('RCON Conectado!');
    io.emit('console:output', '\n[SISTEMA] RCON Conectado com sucesso!');


  } catch (error) {
    console.error('Falha ao conectar RCON:', error);
    io.emit('console:output', `\n[SISTEMA] Falha ao conectar RCON: ${error.message}`);
    setTimeout(connectRcon, 5000);
  }
}


const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg) => {

  const logMessage = msg.toString('utf8').replace(/^..../, ''); 
  
  io.emit('console:output', logMessage);
});

udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`Servidor de Logs UDP ouvindo em ${address.port}`);
});

udpServer.bind(UDP_LOG_PORT);

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.emit('console:output', '[SISTEMA] Painel conectado ao Backend.');
  if (rcon && rcon.authenticated) {
    socket.emit('console:output', '[SISTEMA] RCON está ativo.');
  } else {
    socket.emit('console:output', '[SISTEMA] Tentando conectar ao servidor CS2...');
  }

    socket.on('console:command', async (command) => {
    socket.emit('console:output', `> ${command}`);

    if (!rcon || !rcon.authenticated) {
      socket.emit('console:output', '[ERRO] RCON não está conectado.');
      return;
    }

    try {
      const response = await rcon.send(command);
      if (response) {
        socket.emit('console:output', response);
      }
    } catch (error) {
      socket.emit('console:output', `[ERRO] Falha ao enviar comando: ${error.message}`);
    }
  });
});

httpServer.listen(SOCKET_PORT, () => {
  console.log(`Servidor Backend rodando na porta ${SOCKET_PORT}`);
  connectRcon();
});
