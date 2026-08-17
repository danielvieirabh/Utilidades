const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = '/usr/bin/google-chrome';
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Escuta o evento 'send-whatsapp' vindo da interface
ipcMain.on('send-whatsapp', async (event, { phones, message }) => {
    let browser;
    try {
        event.reply('update-status', 'Iniciando automação e abrindo Chrome...');

        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            userDataDir: path.join(app.getPath('userData'), 'puppeteer_data'),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

        event.reply('update-status', 'Abrindo WhatsApp Web... (Aguardando login)');
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });

        // Espera a tela lateral carregar para ter certeza que logou
        await page.waitForSelector('#pane-side', { timeout: 300000 }); 

        const encodedMessage = encodeURIComponent(message);

        // LOOP DE ENVIO
        for (let i = 0; i < phones.length; i++) {
            const phone = phones[i];
            
            // Usamos um try/catch DENTRO do loop para que, se um número falhar, ele não pare o programa todo
            try {
                event.reply('update-status', `[${i + 1} de ${phones.length}] Carregando chat do número ${phone}...`);
                
                const whatsappUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
                await page.goto(whatsappUrl, { waitUntil: 'domcontentloaded' });

                event.reply('update-status', `[${i + 1} de ${phones.length}] Aguardando a caixa de texto...`);
                
                // Espera pela caixa de texto de mensagem aparecer (se o número for inválido, ele pula pro catch)
                const inputBoxSelector = 'div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]';
                const inputBox = await page.waitForSelector(inputBoxSelector, { timeout: 20000 });

                // Foca na caixa de texto
                await inputBox.focus();
                
                // SOLUÇÃO PARA NÚMEROS NOVOS: Digita um espaço e aperta Enter
                event.reply('update-status', `[${i + 1} de ${phones.length}] Forçando envio da mensagem...`);
                await page.keyboard.type(' '); // Digita um espaço para transformar o microfone em botão de enviar
                await new Promise(resolve => setTimeout(resolve, 500)); // Espera meio segundo pro WhatsApp processar
                await page.keyboard.press('Enter'); // Aperta o botão Enter no teclado para disparar

                // Aguarda 2 segundos para dar tempo da mensagem subir para a rede
                await new Promise(resolve => setTimeout(resolve, 2000)); 

                // Se for o ÚLTIMO número da lista, encerra
                if (i === phones.length - 1) {
                    continue;
                }

                // SISTEMA ANTI-BANIMENTO (PAUSAS)
                if ((i + 1) % 40 === 0) {
                    event.reply('update-status', `⏳ Segurança: Lote de 40 concluído. Descansando por 5 minutos...`);
                    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minuto
                } else {
                    const tempoEspera = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
                    event.reply('update-status', `⏳ Pausa anti-spam: Aguardando ${Math.round(tempoEspera / 1000)} segundos...`);
                    await new Promise(resolve => setTimeout(resolve, tempoEspera)); 
                }

            } catch (loopError) {
                // Cai aqui se o número não tiver WhatsApp ou a internet falhar no meio
                console.error(`Erro ao enviar para ${phone}:`, loopError);
                event.reply('update-status', `⚠️ Aviso: Falha no número ${phone} (pode não ter WhatsApp). Pulando...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa curta antes de ir pro próximo
            }
        }

        event.reply('update-status', `✅ Sucesso total! Processo finalizado.`);

    } catch (error) {
        // Cai aqui se der erro ao abrir o Chrome ou erro grave no bot
        console.error('Erro geral na automação:', error);
        event.reply('update-status', `❌ Erro Grave: ${error.message}`);
    } finally {
        if (browser) {
            // Se quiser fechar o Chrome ao terminar, tire as barras abaixo:
            // await browser.close();
        }
    }
});