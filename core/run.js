// 配置文件
const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

const RLND_FILE = 'rlnd_list.json'
const USER_FILE = 'user_config.json'
const MESSAGE_CACHE_SIZE = 100
const messageCache = new Set()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const swarm = new Hyperswarm()
let currentRLND = null
let connections = new Map()
let username = ''

const { loadRLNDs, saveRLNDs, loadUser, saveUser } = require('../config/config')

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

        if (message.type === 'chat') {
            if ((currentRLND && message.rlnd === currentRLND.rlnd) || !currentRLND) {
                // Removido código de salvar mensagens
                if (currentRLND && message.rlnd === currentRLND.rlnd) {
                    console.log(`\n${message.username}: ${message.message}\n> `)
                }
            }
        }
    } catch (error) {
        console.error("Erro ao processar mensagem:", error.message)
    }
}

function getUsername() {
    const user = loadUser(); // Obtém as configurações do usuário
    if (user && user.username) {
        username = user.username;
        showMenu();
    } else {
        rl.question('Digite seu nome: ', (name) => {
            name = name.trim();
            if (!name || name.length > 30) {
                console.log("Nome inválido. Tente novamente.");
                return getUsername();
            }
            username = name;
            saveUser({ username }); // Salvando objeto do usuário
            showMenu();
        });
    }
}

function showMenu() {
    console.log('\n1. Criar RLND\n2. Listar RLNDs\n3. Conectar a RLND\n4. Ver histórico\n5. Sair')
    rl.question('Escolha uma opção: ', (option) => {
        if (option === '1') createRLND()
        else if (option === '2') listRLNDs()
        else if (option === '3') promptRLNDConnection()
        else if (option === '4') showHistory()
        else if (option === '5') exitRLND()
        else showMenu()
    })
}

function createRLND() {
    rl.question('Nome da RLND: ', (name) => {
        name = name.trim()
        if (!name) {
            console.log("Nome inválido. Tente novamente.")
            return createRLND()
        }
        
        const rlnds = loadRLNDs()
        if (rlnds.some(r => r.rlnd === name)) {
            console.log("RLND já existe. Escolha outro nome.")
            return createRLND()
        }
        
        const newRLND = { 
            rlnd: name, 
            id: crypto.randomBytes(16).toString('hex'), 
            ass: signRLND(name), 
            data: new Date().toISOString() 
        }
        rlnds.push(newRLND)
        saveRLNDs(rlnds)
        broadcastRLNDList()
        connectToRLND(name)
    })
}

function listRLNDs() {
    const rlnds = loadRLNDs()
    if (rlnds.length === 0) {
        console.log("Nenhuma RLND disponível.")
    } else {
        rlnds.forEach((r, i) => console.log(`${i + 1}. ${r.rlnd}`))
    }
    showMenu()
}

function promptRLNDConnection() {
    rl.question('Nome da RLND: ', (name) => connectToRLND(name.trim()))
}

function connectToRLND(rlndName) {
    const rlnd = loadRLNDs().find(r => r.rlnd === rlndName)
    if (!rlnd) {
        console.log("RLND não encontrada.")
        return showMenu()
    }
    
    if (currentRLND) {
        swarm.leave(crypto.createHash('sha256').update(currentRLND.id).digest())
    }
    
    currentRLND = rlnd
    swarm.join(crypto.createHash('sha256').update(rlnd.id).digest(), { lookup: true, announce: true })
    
    console.log(`\nConectado a RLND: ${rlndName}`)
    console.log("Digite suas mensagens (digite /exit para sair):\n")
    
    // Mostrar histórico ao conectar
    showRLNDHistory(rlndName)
    
    chatLoop()
}

function showRLNDHistory(rlndName) {
    const messages = [] // Histórico de mensagens removido
    if (messages.length === 0) {
        console.log("Nenhuma mensagem anterior neste RLND.\n")
    } else {
        console.log("Histórico de mensagens:")
        // Histórico de mensagens removido
        console.log("") 
    }
}

function showHistory() {
    if (!currentRLND) {
        rl.question('Digite o nome do RLND para ver o histórico: ', (rlndName) => {
            showRLNDHistory(rlndName.trim())
            showMenu()
        })
    } else {
        showRLNDHistory(currentRLND.rlnd)
        showMenu()
    }
}

function chatLoop() {
    rl.question('> ', (message) => {
        if (message === '/exit') return exitRLND()
        if (!currentRLND) return showMenu()
        
        const chatMessage = {
            type: 'chat',
            rlnd: currentRLND.rlnd,
            message,
            id: crypto.randomUUID(),
            ass: currentRLND.ass,
            date: new Date().toISOString(),
            username
        }

        // Removido código de salvar mensagem

        const data = JSON.stringify(chatMessage)
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
