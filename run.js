const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const hyperswarm = require('hyperswarm');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para perguntar a porta
function askPort() {
  return new Promise((resolve) => {
    rl.question('Porta de inicialização: ', (port) => {
      resolve(parseInt(port) || 3000);
    });
  });
}

// Função para gerar SHA256
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Função para carregar ou criar arquivos JSON
async function loadOrCreateJson(file, defaultValue) {
  try {
    const data = await fs.readFile(file);
    return JSON.parse(data);
  } catch (e) {
    await fs.writeFile(file, JSON.stringify(defaultValue));
    return defaultValue;
  }
}

// Função para salvar JSON
async function saveJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Inicialização do Hyperswarm
const swarm = new hyperswarm(); // Fixed: Added 'new'
const topic = crypto.createHash('sha256')
  .update('raldowork-rlnds')
  .digest();
swarm.join(topic, { lookup: true, announce: true });

// Servidor HTTP
async function startServer() {
  const port = await askPort();
  const accountsFile = path.join(__dirname, 'accounts.json');
  const forumsFile = path.join(__dirname, 'forums.json');
  const messagesDir = path.join(__dirname, 'messages');

  // Criar diretório de mensagens se não existir
  await fs.mkdir(messagesDir, { recursive: true });

  // Carregar contas e fóruns
  let accounts = await loadOrCreateJson(accountsFile, []);
  let forums = await loadOrCreateJson(forumsFile, []);

  // Função para sincronizar fóruns e mensagens com peers
  swarm.on('connection', (socket, info) => {
    console.log('Conectado a um peer');

    // Enviar fóruns
    socket.write('forums', JSON.stringify(forums));

    // Enviar mensagens de cada fórum
    fs.readdir(messagesDir).then(async (files) => {
      for (const file of files) {
        const messages = await loadOrCreateJson(path.join(messagesDir, file), []);
        socket.write('messages', JSON.stringify({ forumId: file.replace('.json', ''), messages }));
      }
    });

    // Receber dados do peer
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      try {
        const messages = buffer.split('\n').filter(m => m).map(m => JSON.parse(m));
        buffer = '';
        messages.forEach(async (msg) => {
          if (msg.type === 'forums') {
            const remoteForums = JSON.parse(msg.data);
            forums = [...new Set([...forums, ...remoteForums])]; // Mesclar sem duplicatas
            await saveJson(forumsFile, forums);
          } else if (msg.type === 'messages') {
            const { forumId, messages: remoteMessages } = JSON.parse(msg.data);
            const messageFile = path.join(messagesDir, `${forumId}.json`);
            const localMessages = await loadOrCreateJson(messageFile, []);
            const updatedMessages = [...new Set([...localMessages, ...remoteMessages])];
            await saveJson(messageFile, updatedMessages);
          }
        });
      } catch (e) {
        console.error('Erro ao processar dados do peer:', e);
      }
    });
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/' && req.method === 'GET') {
      // Servir index.html
      const html = await fs.readFile(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else if (pathname === '/login' && req.method === 'POST') {
      // Login ou criação de conta
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { username, password } = JSON.parse(body);
        const hashedPassword = sha256(password);
        const account = accounts.find(acc => acc.nome === username);

        if (account) {
          // Verificar senha
          if (account.senha === hashedPassword) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: account.id, assinatura: account.ass }));
          } else {
            res.writeHead(401);
            res.end('Senha incorreta');
          }
        } else {
          // Criar nova conta
          const id = crypto.randomBytes(16).toString('hex');
          const assinatura = crypto.randomBytes(8).toString('hex');
          const newAccount = {
            nome: username,
            senha: hashedPassword,
            ass: assinatura,
            data: new Date().toISOString(),
            id
          };
          accounts.push(newAccount);
          await saveJson(accountsFile, accounts);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id, assinatura }));
        }
      });
    } else if (pathname === '/forums' && req.method === 'GET') {
      // Listar fóruns
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(forums));
    } else if (pathname === '/create-forum' && req.method === 'POST') {
      // Criar fórum
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { name, userId, assinatura } = JSON.parse(body);
        const account = accounts.find(acc => acc.id === userId && acc.ass === assinatura);
        if (!account) {
          res.writeHead(401);
          res.end('Usuário inválido');
          return;
        }
        const forumId = crypto.randomBytes(16).toString('hex');
        const newForum = {
          nome: name,
          id: forumId,
          data: new Date().toISOString(),
          ass: assinatura
        };
        forums.push(newForum);
        await saveJson(forumsFile, forums);
        // Criar arquivo de mensagens para o fórum
        await saveJson(path.join(messagesDir, `${forumId}.json`), []);
        res.writeHead(200);
        res.end('Fórum criado');
      });
    } else if (pathname.startsWith('/messages/') && req.method === 'GET') {
      // Obter mensagens de um fórum
      const forumId = pathname.split('/')[2];
      const messageFile = path.join(messagesDir, `${forumId}.json`);
      const messages = await loadOrCreateJson(messageFile, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(messages));
    } else if (pathname.startsWith('/messages/') && req.method === 'POST') {
      // Enviar mensagem para um fórum
      const forumId = pathname.split('/')[2];
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { content, userId, assinatura } = JSON.parse(body);
        const account = accounts.find(acc => acc.id === userId && acc.ass === assinatura);
        if (!account) {
          res.writeHead(401);
          res.end('Usuário inválido');
          return;
        }
        const messageFile = path.join(messagesDir, `${forumId}.json`);
        const messages = await loadOrCreateJson(messageFile, []);
        const newMessage = {
          id: crypto.randomBytes(16).toString('hex'),
          content,
          userId,
          assinatura,
          data: new Date().toISOString()
        };
        messages.push(newMessage);
        await saveJson(messageFile, messages);
        res.writeHead(200);
        res.end('Mensagem enviada');
      });
    } else {
      res.writeHead(404);
      res.end('Não encontrado');
    }
  });

  server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

startServer();
