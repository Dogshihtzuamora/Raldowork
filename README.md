Aqui está um **README.md** atualizado, incluindo informações sobre o **cron job** (`cron.js`) e sua funcionalidade de limpeza automática de arquivos JSON antigos.  

---

# **Raldowork**

Raldowork é um sistema descentralizado de chat baseado em RLNDs (Redes Locais de Nome Descentralizado), permitindo comunicação segura e privada entre usuários conectados. Aproveite a tecnologia de redes peer-to-peer e criptografia para trocar mensagens de forma eficiente e sem intermediários.

## 🚀 **Características principais**

- [x] **Comunicação Descentralizada** → Utilize redes **peer-to-peer** para trocar mensagens sem depender de servidores centrais.  
- [x] **Criação e Listagem de RLNDs** → Crie redes locais e veja as redes disponíveis para se conectar.  
- [x] **Conexão Segura** → Conecte-se a RLNDs específicas e compartilhe mensagens de forma privada.  
- [x] **Histórico de Mensagens** → Veja o histórico de mensagens em cada RLND, para não perder nada.  
- [x] **Armazenamento Local** → O sistema mantém o histórico de mensagens localmente para garantir a privacidade e segurança.  
- [x] **Mensagem Cache** → Reduza a duplicidade de mensagens com um cache inteligente para mensagens já processadas.  
- [x] **Sistema de Limpeza Automática** → Um *cron job* executa a cada hora a remoção de arquivos JSON antigos (com mais de **36 horas**).  

---

## 🛠️ **Como Funciona**

Raldowork utiliza o **Hyperswarm**, um módulo baseado em **WebRTC**, para a criação de redes **peer-to-peer** dinâmicas. Isso permite que os usuários conectem-se diretamente uns aos outros e compartilhem mensagens sem necessidade de servidores centralizados.

### **Fluxo básico do sistema:**

1️⃣ **Criação de RLNDs** → O usuário pode criar uma RLND (rede local), onde outros usuários podem se conectar.  
2️⃣ **Conexão e Chat** → Após a criação de uma RLND, o usuário pode se conectar e começar a trocar mensagens em tempo real.  
3️⃣ **Histórico de Mensagens** → O sistema mantém um histórico de mensagens salvo localmente.  
4️⃣ **Limpeza de Arquivos** → A cada **1 hora**, um *cron job* verifica e remove arquivos JSON antigos (> 36 horas).  
5️⃣ **Desconectar-se** → O usuário pode sair de uma RLND a qualquer momento, sem perder suas configurações.  

---

## 📦 **Instalação**

1️⃣ **Clone o repositório:**
```bash
git clone https://github.com/Dogshihtzuamora/Raldowork.git
cd Raldowork
```

2️⃣ **Instale as dependências:**
```bash
npm install
```

3️⃣ **Execute o sistema de chat:**
```bash
node core/run.js
```

---

## 🕒 **Cron Job: Limpeza Automática de Arquivos JSON**

O **cron job (`core/cron.js`)** foi projetado para manter o sistema organizado, removendo arquivos antigos. Ele:

- Executa **a cada 1 hora**.
- Verifica **arquivos JSON armazenados localmente**.
- Remove **arquivos com mais de 36 horas** de idade para evitar acúmulo de dados desnecessários.

Esse processo garante que o Raldowork **funcione de forma eficiente**, sem ocupar espaço excessivo no armazenamento local.

---

## 🔧 **Arquitetura e Tecnologias Usadas**

🔹 **Node.js** → Plataforma de desenvolvimento de aplicações server-side com JavaScript.  
🔹 **Hyperswarm** → Biblioteca para criação de redes **peer-to-peer** descentralizadas.  
🔹 **Crypto** → Utilizado para gerar IDs e assinar dados de forma segura.  
🔹 **Filesystem (fs)** → Usado para armazenar configurações e histórico de mensagens localmente.  
🔹 **Readline** → Permite interação via terminal para envio de mensagens.  
🔹 **Node-cron** → Agendamento de tarefas automáticas para limpeza de arquivos JSON antigos.  

---

## 🔐 **Segurança**

- [x] **Criptografia de mensagens** → As mensagens são assinadas usando **HMAC (SHA-256)** para garantir integridade e autenticidade.  
- [x] **Comunicação segura** → Utiliza tecnologia **WebRTC** para comunicação direta entre os peers, sem intermediários.  
- [x] **Limpeza automatizada** → Arquivos JSON antigos são removidos automaticamente para evitar acúmulo de dados desnecessários.  

---

## 📜 **Como Contribuir?**

Contribuições são **bem-vindas**! Se você encontrou um bug ou deseja adicionar novas funcionalidades, siga os passos abaixo:

1️⃣ Faça um *fork* do projeto.  
2️⃣ Crie uma **nova branch** para suas alterações.  
3️⃣ Teste suas mudanças localmente.  
4️⃣ Envie um **pull request** detalhando suas melhorias.  

---

## 📄 **Licença**

Este projeto é licenciado sob a **MIT License**. Veja mais detalhes no arquivo [LICENSE](LICENSE).  

---

💡 **Dúvidas ou sugestões?** Entre em contato ou abra uma *issue* no GitHub! 🚀
