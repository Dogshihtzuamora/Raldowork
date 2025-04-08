function run() {
    const Hyperswarm = require('hyperswarm')
    const crypto = require('crypto')
    const readline = require('readline')
    const fs = require('fs')
    const { deleteOldMessageFiles } = require('./cron')
    const path = require('path')
    const colors = require('colors/safe')

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

    function getMessagesFileName(rlndName) {
        return `${rlndName.replace(/[^a-z0-9]/gi, '_')}_msg.json`
    }

    function loadMessages(rlndName) {
        const fileName = getMessagesFileName(rlndName)
        return fs.existsSync(fileName) ? JSON.parse(fs.readFileSync(fileName, 'utf-8')) : []
    }

    function saveMessage(rlndName, message) {
        const fileName = getMessagesFileName(rlndName)
        const messages = loadMessages(rlndName)
        messages.push({
            id: message.id,
            user: message.username,
            date: message.date,
            msg: message.message
        })
        fs.writeFileSync(fileName, JSON.stringify(messages, null, 2), 'utf-8')
    }

    function broadcastRLNDList() {
        const message = JSON.stringify({ type: 'list_rlnd', rlnds: loadRLNDs(), id: crypto.randomUUID() })
        for (const connection of connections.values()) connection.write(message)
    }

    function broadcastMessages(rlndName) {
        const messages = loadMessages(rlndName)
        const messagePacket = JSON.stringify({ 
            type: 'sync_messages', 
            rlnd: rlndName, 
            messages: messages,
            id: crypto.randomUUID(),
            sender: username
        })
        
        for (const connection of connections.values()) {
            connection.write(messagePacket)
        }
    }

    function requestMessages(rlndName) {
        const requestPacket = JSON.stringify({ 
            type: 'request_messages', 
            rlnd: rlndName,
            id: crypto.randomUUID(),
            sender: username
        })
        
        for (const connection of connections.values()) {
            connection.write(requestPacket)
        }
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
        console.error(colors.red(`Erro de conexão com o peer ${remoteId}: ${err.message}`))
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
                    saveMessage(message.rlnd, message)
                    
                    if (currentRLND && message.rlnd === currentRLND.rlnd) {
                        console.log(colors.blue(`\n${message.username}:`), colors.green(`${message.message}\n> `))
                    }
                }
            }
            
            if (message.type === 'request_messages') {
                const rlndName = message.rlnd
                broadcastMessages(rlndName)
            }
            
            if (message.type === 'sync_messages') {
                const rlndName = message.rlnd
                const remoteMessages = message.messages
                const fileName = getMessagesFileName(rlndName)
                
                let localMessages = []
                if (fs.existsSync(fileName)) {
                    localMessages = JSON.parse(fs.readFileSync(fileName, 'utf-8'))
                }
                
                const idSet = new Set(localMessages.map(m => m.id))
                let updated = false
                
                remoteMessages.forEach(msg => {
                    if (!idSet.has(msg.id)) {
                        localMessages.push(msg)
                        updated = true
                    }
                })
                
                if (updated) {
                    localMessages.sort((a, b) => new Date(a.date) - new Date(b.date))
                    fs.writeFileSync(fileName, JSON.stringify(localMessages, null, 2), 'utf-8')
                    
                    if (currentRLND && currentRLND.rlnd === rlndName) {
                        console.log(colors.green("\nHistórico atualizado.\n> "))
                    }
                }
            }
        } catch (error) {
            console.error(colors.red("Erro ao processar mensagem:"), error.message)
        }
    }

    function getUsername() {
        deleteOldMessageFiles();
        const user = loadUser()
        if (user && user.username) {
            username = user.username
            showMenu()
        } else {
            rl.question('Digite seu nome: ', (name) => {
                name = name.trim()
                if (!name || name.length > 30) {
                    console.log(colors.red("Nome inválido. Tente novamente."))
                    return getUsername()
                }
                username = name
                saveUser(username)
                showMenu()
            })
        }
    }

    function showMenu() {
        console.log(colors.yellow('\n1. Criar RLND\n2. Listar RLNDs\n3. Conectar a RLND\n4. Ver histórico\n5. Sair\n'))
        rl.question('\nEscolha uma opção: ', (option) => {
            if (option === '1') createRLND()
            else if (option === '2') listRLNDs()
            else if (option === '3') promptRLNDConnection()
            else if (option === '4') showHistory()
            else if (option === '5') finish()
            else showMenu()
        })
    }

    function createRLND() {
        rl.question('Nome da RLND: ', (name) => {
            name = name.trim()
            if (!name) {
                console.log(colors.red("Nome inválido. Tente novamente."))
                return createRLND()
            }
            
            const rlnds = loadRLNDs()
            if (rlnds.some(r => r.rlnd === name)) {
                console.log(colors.red("RLND já existe. Escolha outro nome."))
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
            console.log(colors.red("Nenhuma RLND disponível."))
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
            console.log(colors.red("RLND não encontrada."))
            return showMenu()
        }
        
        if (currentRLND) {
            swarm.leave(crypto.createHash('sha256').update(currentRLND.id).digest())
        }
        
        currentRLND = rlnd
        swarm.join(crypto.createHash('sha256').update(rlnd.id).digest(), { lookup: true, announce: true })
        
        console.log(colors.green(`\nConectado a RLND: ${rlndName}`))
        console.log("Digite suas mensagens (digite /exit para sair):\n")
        
        requestMessages(rlndName)
        setTimeout(() => {
            showRLNDHistory(rlndName)
            chatLoop()
        }, 500)
    }

    function showRLNDHistory(rlndName) {
        const messages = loadMessages(rlndName)
        if (messages.length === 0) {
            console.log(colors.yellow("Nenhuma mensagem anterior neste RLND.\n"))
        } else {
            console.log(colors.blue("Histórico de mensagens:"))
            messages.forEach(msg => {
                console.log(colors.blue(`[${new Date(msg.date).toLocaleString()}]`), colors.green(`${msg.user}:`), msg.msg)
            })
            console.log("") 
        }
    }

    function showHistory() {
        if (!currentRLND) {
            rl.question('Digite o nome do RLND para ver o histórico: ', (rlndName) => {
                const rlndNameTrimmed = rlndName.trim();
                requestMessages(rlndNameTrimmed);
                
                setTimeout(() => {
                    showRLNDHistory(rlndNameTrimmed);
                    showMenu();
                }, 500);
            })
        } else {
            requestMessages(currentRLND.rlnd);
            
            setTimeout(() => {
                showRLNDHistory(currentRLND.rlnd);
                showMenu();
            }, 500);
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
            
            saveMessage(currentRLND.rlnd, chatMessage)
            
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
            console.log(colors.red(`Você saiu da RLND: ${currentRLND.rlnd}`))
            currentRLND = null
        }
        showMenu()
    }

    function finish() {
        console.log(colors.red("\nEncerrando..."))
        process.exit(0); // fim de tudo
    

    }
    function signRLND(name) {
        return crypto.createHmac('sha256', crypto.randomBytes(32)).update(name).digest('hex')
    }
    getUsername()
    deleteOldMessageFiles()
}

// Exporta a função run para que possa ser usada em outros arquivos
module.exports = {run};


            
