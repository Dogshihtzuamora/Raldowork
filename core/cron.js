const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const MESSAGE_FILE_PATTERN = /_msg\.json$/;
const EXPIRATION_TIME = 36 * 60 * 60 * 1000; // 36 horas em milissegundos

function deleteOldMessageFiles() {
    const files = fs.readdirSync(__dirname);
    const now = Date.now();

    files.forEach(file => {
        if (MESSAGE_FILE_PATTERN.test(file)) {
            const filePath = path.join(__dirname, file);
            const stats = fs.statSync(filePath);
            const fileAge = now - stats.mtimeMs;

            if (fileAge > EXPIRATION_TIME) {
                fs.unlinkSync(filePath);
                console.log(`Arquivo antigo removido: ${file}`);
            }
        }
    });
}

// Agendando a tarefa para rodar a cada hora
cron.schedule('0 * * * *', () => {
    console.log('Verificando arquivos de mensagens antigos...');
    deleteOldMessageFiles();
});

module.exports = { deleteOldMessageFiles };