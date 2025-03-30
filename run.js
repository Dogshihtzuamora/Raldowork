const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const readline = require('readline')
const fs = require('fs')

const RLND_FILE = 'rlnd_list.json'
const USER_FILE = 'user_config.json'
const MESSAGE_CACHE_SIZE = 100
const messageCache = new Set()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const swarm = new Hyperswarm()
let currentRLND = null
let connections = new Map()
let username = ''

function loadRLNDs() {
    return fs.existsSync(RLND_FILE) ? JSON.parse(fs.readFileSync(RLND_FILE, 'utf-8')) : []
}

function saveRLNDs(rlnds) {
    fs.writeFileSync(RLND_FILE, JSON.stringify(rlnds, null, 2), 'utf-8')
}

function loadUser() {
    return fs.existsSync(USER_FILE) ? JSON.parse(fs.readFileSync(USER_FILE, 'utf-8')) : null
}

function saveUser(name) {
    const userData = { username: name }
    fs.writeFileSync(USER_FILE, JSON.stringify(userData, null, 2), 'utf-8')
}

function broadcastRLNDList() {
    const message = JSON.stringify({ type: 'list_rlnd', rlnds: loadRLNDs(), id: crypto.randomUUID() })
    for (const connection of connections.values()) connection.write(message)
}

swarm.join(crypto.createHash('sha256').update('Raldowork').digest(), { lookup: true, announce: true })

swarm.on('connection', (connection, info) => {
    const remoteId = info.publicKey.toString('hex')
    if (connections.has(remoteId)) return
    connections.set(remoteId, connection)
    connection.write(JSON.stringify({ type: 'list_rlnd', rlnds: loadRLNDs(), id: crypto.randomUUID() }))
    connection.on('data', (data) => handleMessage(data.toString()))
    connection.on('close', () => connections.delete(remoteId))
    connection.on('error', (err) => handleConnectionError(err, remoteId))
})

function handleConnectionError(err, remoteId) {
    console.error(`Erro de conexão com o peer ${remoteId}: ${err.message}`)
    connections.delete(remoteId)
}

function handleMessage(data) {
    try {
        const message = JSON.parse(data)
        if (message.id && messageCache.has(message.id)) return
        if (message.id) {
            messageCache.add(message.id)
            if (messageCache.size > MESSAGE_CACHE_SIZE) messageCache.delete(messageCache.values().next().value)
        }

        if (message.type === 'list_rlnd') {
            const localRLNDs = loadRLNDs()
            let updated = false
            message.rlnds.forEach(rlnd => {
                if (!localRLNDs.some(local => local.id === rlnd.id)) {
                    localRLNDs.push(rlnd)
                    updated = true
                }
            })
            if (updated) saveRLNDs(localRLNDs)
        }

        if (message.type === 'chat' && currentRLND && message.rlnd === currentRLND.rlnd) {
            console.log(`\n${message.username}: ${message.message}\n> `)
        }
    } catch (error) {
        console.error("Erro ao processar mensagem:", error.message)
    }
}

function getUsername() {
    const user = loadUser()
    if (user && user.username) {
        username = user.username
        showMenu()
    } else {
        rl.question('Digite seu nome: ', (name) => {
            username = name.trim() || 'Usuário'
            saveUser(username)
            showMenu()
        })
    }
}

function showMenu() {
    console.log('\n1. Criar RLND\n2. Listar RLNDs\n3. Conectar a RLND\n4. Sair')
    rl.question('Escolha uma opção: ', (option) => {
        if (option === '1') createRLND()
        else if (option === '2') listRLNDs()
        else if (option === '3') promptRLNDConnection()
        else if (option === '4') exitRLND()
        else showMenu()
    })
}

function createRLND() {
    rl.question('Nome da RLND: ', (name) => {
        const rlnds = loadRLNDs()
        if (rlnds.some(r => r.rlnd === name)) return showMenu()
        const newRLND = { rlnd: name, id: crypto.randomBytes(16).toString('hex'), ass: signRLND(name), data: new Date().toISOString() }
        rlnds.push(newRLND)
        saveRLNDs(rlnds)
        broadcastRLNDList()
        connectToRLND(name)
    })
}

function listRLNDs() {
    loadRLNDs().forEach((r, i) => console.log(`${i + 1}. ${r.rlnd}`))
    showMenu()
}

function promptRLNDConnection() {
    rl.question('Nome da RLND: ', (name) => connectToRLND(name.trim()))
}

function connectToRLND(rlndName) {
    const rlnd = loadRLNDs().find(r => r.rlnd === rlndName)
    if (!rlnd) return showMenu()
    if (currentRLND) swarm.leave(crypto.createHash('sha256').update(currentRLND.id).digest())
    currentRLND = rlnd
    swarm.join(crypto.createHash('sha256').update(rlnd.id).digest(), { lookup: true, announce: true })
    console.log(`Conectado a RLND: ${rlndName}\nDigite suas mensagens:`)
    chatLoop()
}

function chatLoop() {
    rl.question('> ', (message) => {
        if (message === '/exit') return exitRLND()
        if (!currentRLND) return showMenu()
        const data = JSON.stringify({ type: 'chat', rlnd: currentRLND.rlnd, message, id: crypto.randomUUID(), ass: currentRLND.ass, data: new Date().toISOString(), username })
        for (const connection of connections.values()) {
            connection.write(data)
        }
        chatLoop()
    })
}

function exitRLND() {
    if (currentRLND) {
        swarm.leave(crypto.createHash('sha256').update(currentRLND.id).digest())
        console.log(`Você saiu da RLND: ${currentRLND.rlnd}`)
        currentRLND = null
    }
    showMenu()
}

function signRLND(name) {
    return crypto.createHmac('sha256', crypto.randomBytes(32)).update(name).digest('hex')
}

getUsername()
