let userId = null;
let userSignature = null;
let currentForumName = null;

function showLogin() {
  document.getElementById('login').style.display = 'block';
  document.getElementById('register').style.display = 'none';
  document.getElementById('forum-list').style.display = 'none';
  document.getElementById('messages').style.display = 'none';
}

function showRegister() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('register').style.display = 'block';
}

function showForums() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('register').style.display = 'none';
  document.getElementById('forum-list').style.display = 'block';
  document.getElementById('messages').style.display = 'none';
  loadForums();
}

function showMessages(forumName) {
  currentForumName = forumName;
  document.getElementById('forum-list').style.display = 'none';
  document.getElementById('messages').style.display = 'block';
  loadMessages();
}

async function register() {
  const name = document.getElementById('register-name').value;
  const password = document.getElementById('register-password').value;

  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password })
  });

  if (response.ok) {
    const data = await response.json();
    userId = data.id;
    userSignature = data.ass;
    alert('Conta criada com sucesso!');
    showLogin();
  } else {
    alert('Erro ao registrar');
  }
}

async function login() {
  const name = document.getElementById('login-name').value;
  const password = document.getElementById('login-password').value;

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password })
  });

  if (response.ok) {
    const data = await response.json();
    userId = data.id;
    userSignature = data.ass;
    showForums();
  } else {
    alert('Credenciais inválidas');
  }
}

async function loadForums() {
  const response = await fetch('/api/forums');
  const forums = await response.json();
  const forumsDiv = document.getElementById('forums');
  forumsDiv.innerHTML = '';
  forums.forEach(forum => {
    const div = document.createElement('div');
    div.className = 'forum';
    div.innerHTML = `
      <h3>${forum.nome}</h3>
      <p>Criado por: ${forum.ass} em ${new Date(forum.data).toLocaleString()}</p>
      <button onclick="showMessages('${forum.nome}')">Entrar</button>
    `;
    forumsDiv.appendChild(div);
  });
}

async function createForum() {
  const name = prompt('Nome do fórum:');
  if (name && userId && userSignature) {
    const response = await fetch('/api/create-forum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId, signature: userSignature })
    });
    if (response.ok) {
      loadForums();
    } else {
      alert('Erro ao criar fórum');
    }
  }
}

async function loadMessages() {
  const response = await fetch(`/api/messages?f=${encodeURIComponent(currentForumName)}`);
  const messages = await response.json();
  const messageList = document.getElementById('message-list');
  messageList.innerHTML = '';
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `
      <p><strong>${msg.ass}</strong> (${new Date(msg.data).toLocaleString()}):</p>
      <p>${msg.message}</p>
    `;
    messageList.appendChild(div);
  });
}

async function postMessage() {
  const message = document.getElementById('message-input').value;
  if (message && userId && userSignature && currentForumName) {
    const response = await fetch(`/api/post-message?f=${encodeURIComponent(currentForumName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, signature: userSignature, message })
    });
    if (response.ok) {
      document.getElementById('message-input').value = '';
      loadMessages();
    } else {
      alert('Erro ao enviar mensagem');
    }
  }
}

function backToForums() {
  showForums();
}

// Verifica se há um fórum na URL
const urlParams = new URLSearchParams(window.location.search);
const forumName = urlParams.get('f');
if (forumName && userId) {
  showMessages(decodeURIComponent(forumName));
} else {
  showLogin();
}