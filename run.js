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

// Caminhos
const PUBLIC_DIR = path.join(__dirname, 'public');
const RALDOWORK_DIR = path.join(__dirname, 'Raldowork');
const ACC_JSON = path.join(__dirname, 'Acc.json');
const RLNDS_JSON = path.join(RALDOWORK_DIR, 'Rlnds.json');

// Inicializa arquivos JSON
async function initAccJson() {
  try {
    await fs.access(ACC_JSON);
  } catch {
    await fs.writeFile(ACC_JSON, JSON.stringify({ user: null }));
  }
}

async function initRlndsJson() {
  try {
    await fs.access(RLNDS_JSON);
  } catch {
    await fs.writeFile(RLNDS_JSON, JSON.stringify([]));
  }
}

// Lê e escreve JSON
async function readJson(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return file === ACC_JSON ? { user: null } : [];
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Gera ID único
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// Gera assinatura aleatória
function generateSignature() {
  return crypto.randomBytes(8).toString('hex');
}

// Gera hash SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Inicializa hyperswarm
function startSwarm() {
  const swarm = new hyperswarm();
  const topic = crypto.createHash('sha256').update('raldowork-rlnds').digest();

  swarm.join(topic, { lookup: true, announce: true });

  swarm.on('connection', async (conn, info) => {
    console.log('Novo peer conectado!');
    // Envia Rlnds.json
    const rlndsData = await readJson(RLNDS_JSON);
    conn.write(JSON.stringify({ type: 'rlnds', data: rlndsData }));

    // Envia mensagens de cada fórum
    for (const forum of rlndsData) {
      const messagesFile = path.join(RALDOWORK_DIR, `${forum.nome}.json`);
      const messages = await readJson(messagesFile);
      conn.write(JSON.stringify({ type: 'messages', forum: forum.nome, data: messages }));
    }

    conn.on('data', async (data) => {
      try {
        const received = JSON.parse(data);
        if (received.type === 'rlnds') {
          const localData = await readJson(RLNDS_JSON);
          const merged = [...new Set([...localData, ...received.data])];
          await writeJson(RLNDS_JSON, merged);
        } else if (received.type === 'messages') {
          const messagesFile = path.join(RALDOWORK_DIR, `${received.forum}.json`);
          const localMessages = await readJson(messagesFile);
          const merged = [...new Set([...localMessages, ...received.data])];
          await writeJson(messagesFile, merged);
        }
      } catch (e) {
        console.error('Erro ao processar dados do peer:', e);
      }
    });
  });
}

// Servidor HTTP
function startServer(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === 'GET') {
      if (pathname === '/' || pathname === '/index.html') {
        const filePath = path.join(PUBLIC_DIR, 'index.html');
        const content = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else if (pathname === '/Raldowork/main.js') {
        const filePath = path.join(RALDOWORK_DIR, 'main.js');
        const content = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      } else if (pathname === '/api/forums') {
        const rlndsData = await readJson(RLNDS_JSON);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rlndsData));
      } else if (pathname === '/api/messages' && url.searchParams.has('f')) {
        const forumName = url.searchParams.get('f');
        const messagesFile = path.join(RALDOWORK_DIR, `${forumName}.json`);
        const messages = await readJson(messagesFile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(messages));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          if (pathname === '/api/register') {
            const { name, password } = data;
            const accData = await readJson(ACC_JSON);
            if (accData.user) {
              res.writeHead(400);
              res.end('Já existe uma conta local');
              return;
            }
            const userId = generateId();
            const signature = generateSignature();
            accData.user = {
              nome: name,
              senha: hashPassword(password),
              ass: signature,
              data: new Date().toISOString(),
              id: userId
            };
            await writeJson(ACC_JSON, accData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: userId, ass: signature }));
          } else if (pathname === '/api/login') {
            const { name, password } = data;
            const accData = await readJson(ACC_JSON);
            const hashedPassword = hashPassword(password);
            if (accData.user && accData.user.nome === name && accData.user.senha === hashedPassword) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ id: accData.user.id, ass: accData.user.ass }));
            } else {
              res.writeHead(401);
              res.end('Credenciais inválidas');
            }
          } else if (pathname === '/api/create-forum') {
            const { name, userId, signature } = data;
            const rlndsData = await readJson(RLNDS_JSON);
            const forumId = generateId();
            rlndsData.push({
              nome: name,
              id: forumId,
              data: new Date().toISOString(),
              ass: signature
            });
            await writeJson(RLNDS_JSON, rlndsData);
            // Inicializa arquivo de mensagens do fórum
            const messagesFile = path.join(RALDOWORK_DIR, `${name}.json`);
            await writeJson(messagesFile, []);
            res.writeHead(200);
            res.end('Fórum criado');
          } else if (pathname === '/api/post-message' && url.searchParams.has('f')) {
            const forumName = url.searchParams.get('f');
            const { userId, signature, message } = data;
            const rlndsData = await readJson(RLNDS_JSON);
            const forum = rlndsData.find(f => f.nome === forumName);
            if (forum) {
              const messagesFile = path.join(RALDOWORK_DIR, `${forumName}.json`);
              const messages = await readJson(messagesFile);
              messages.push({
                id: generateId(),
                userId,
                message,
                data: new Date().toISOString(),
                ass: signature
              });
              await writeJson(messagesFile, messages);
              res.writeHead(200);
              res.end('Mensagem enviada');
            } else {
              res.writeHead(404);
              res.end('Fórum não encontrado');
            }
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        } catch (e) {
          res.writeHead(500);
          res.end('Erro interno');
        }
      });
    } else {
      res.writeHead(405);
      res.end('Método não permitido');
    }
  });

  server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    startSwarm();
  });
}

// Inicializa
async function init() {
  await initAccJson();
  await initRlndsJson();
  rl.question('Porta de inicialização: ', (port) => {
    startServer(port);
  });
}

init();