const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = '/usr/bin/google-chrome';
let mainWindow;

// Helper para pausas aleatórias, para simular comportamento humano
const randomDelay = (min, max) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

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

        // Variáveis para o controle de pausas longas e aleatórias
        let messagesSentSinceLastBreak = 0;
        let nextLongBreakAt = Math.floor(Math.random() * (200 - 100 + 1)) + 100; // Próxima pausa longa entre 100 e 200 msgs

        // LOOP DE ENVIO
        for (let i = 0; i < phones.length; i++) {
            const phone = phones[i];
            
            try {
                event.reply('update-status', `[${i + 1} de ${phones.length}] Carregando chat do número ${phone}...`);
                
                // Abrimos o chat sem a mensagem pré-digitada para simular digitação real
                const whatsappUrl = `https://web.whatsapp.com/send?phone=${phone}`;
                await page.goto(whatsappUrl, { waitUntil: 'domcontentloaded' });

                event.reply('update-status', `[${i + 1} de ${phones.length}] Aguardando a caixa de texto...`);
                
                const inputBoxSelector = 'div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]';
                const inputBox = await page.waitForSelector(inputBoxSelector, { timeout: 20000 });

                await inputBox.focus();
                await randomDelay(1000, 2000); // Pausa curta (1-2s) antes de digitar
                
                // Digita a mensagem com velocidade variável para simular comportamento humano
                // event.reply('update-status', `[${i + 1} de ${phones.length}] Digitando a mensagem...`);
                // const typingDelay = Math.floor(Math.random() * (50 - 10 + 1)) + 10; // Variação de 10-50ms por tecla
                // await inputBox.type(message, { delay: typingDelay });
                // Digita a mensagem com velocidade variável para simular comportamento humano
                event.reply('update-status', `[${i + 1} de ${phones.length}] Digitando a mensagem...`);
                const typingDelay = Math.floor(Math.random() * (50 - 10 + 1)) + 10; // Variação de 10-50ms por tecla
                
                // Divide a mensagem em parágrafos para não enviar picado
                const lines = message.split('\n');
                for (let j = 0; j < lines.length; j++) {
                    await inputBox.type(lines[j], { delay: typingDelay });
                    
                    // Se não for a última linha, aperta Shift + Enter para pular a linha sem enviar
                    if (j < lines.length - 1) {
                        await page.keyboard.down('Shift');
                        await page.keyboard.press('Enter');
                        await page.keyboard.up('Shift');
                    }
                }

                await randomDelay(1000, 2000); // Pausa curta (1-2s) antes de enviar

                event.reply('update-status', `[${i + 1} de ${phones.length}] Enviando mensagem...`);
                await page.keyboard.press('Enter');

                await randomDelay(2000, 4000); // Aguarda 2-4s para a mensagem ser processada

                messagesSentSinceLastBreak++;

                // Se for o último número da lista, não precisa pausar
                if (i === phones.length - 1) {
                    continue;
                }

                // SISTEMA ANTI-BANIMENTO (PAUSAS ESTRATÉGICAS)
                if (messagesSentSinceLastBreak >= nextLongBreakAt) {
                    const longPause = Math.floor(Math.random() * (300000 - 120000 + 1)) + 120000; // 2-5 minutos
                    const pauseInMinutes = Math.round(longPause / 60000);
                    event.reply('update-status', `⏳ Segurança: Lote grande (${messagesSentSinceLastBreak}) concluído. Descansando por ~${pauseInMinutes} minutos...`);
                    await randomDelay(longPause, longPause);
                    
                    messagesSentSinceLastBreak = 0;
                    nextLongBreakAt = Math.floor(Math.random() * (200 - 100 + 1)) + 100;
                } else if ((i + 1) % 40 === 0) {
                    event.reply('update-status', `⏳ Segurança: Lote de 40 concluído. Descansando por 1 minuto...`);
                    await randomDelay(60000, 60000); // 1 minuto
                } else {
                    const shortPause = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000; // 15-35 segundos
                    event.reply('update-status', `⏳ Pausa anti-spam: Aguardando ${Math.round(shortPause / 1000)} segundos...`);
                    await randomDelay(shortPause, shortPause);
                }

            } catch (loopError) {
                // Cai aqui se o número não tiver WhatsApp ou a internet falhar no meio
                console.error(`Erro ao enviar para ${phone}:`, loopError);
                event.reply('update-status', `⚠️ Aviso: Falha no número ${phone} (pode não ter WhatsApp). Pulando...`);
                await randomDelay(2500, 3500); // Pausa curta antes de ir pro próximo
            }
        }

        event.reply('update-status', `✅ Sucesso total! Processo finalizado.`);

    } catch (error) {
        // Cai aqui se der erro ao abrir o Chrome ou erro grave no bot
        console.error('Erro geral na automação:', error);
        event.reply('update-status', `❌ Erro Grave: ${error.message}`);
    } finally {
        if (browser) {
    
             await browser.close();
            // Se quiser fechar o Chrome ao terminar, tire as barras abaixo:
            // await browser.close();
        }
    }
});