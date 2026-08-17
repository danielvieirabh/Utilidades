const sendButton = document.getElementById('sendButton');
const phoneNumbersInput = document.getElementById('phoneNumbers');
const messageInput = document.getElementById('message');
const statusDiv = document.getElementById('status');

sendButton.addEventListener('click', () => {
    const rawPhones = phoneNumbersInput.value.split('\n');
    
    const phones = rawPhones
        .map(phone => phone.replace(/\D/g, '')) // Limpa tudo que não é número
        .filter(phone => phone.length > 0);
    
    const message = messageInput.value;

    if (phones.length === 0) {
        statusDiv.textContent = 'Por favor, insira pelo menos um número válido.';
        statusDiv.className = 'status-area error';
        return;
    }

    if (!message.trim()) {
        statusDiv.textContent = 'Por favor, escreva uma mensagem.';
        statusDiv.className = 'status-area error';
        return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'Enviando em Lotes...';
    statusDiv.className = 'status-area';

    window.electronAPI.sendWhatsapp({ phones, message });
});

window.electronAPI.onUpdateStatus((status) => {
    statusDiv.textContent = status;
    statusDiv.className = status.includes('ERRO') || status.includes('❌') ? 'status-area error' : 'status-area';

    if (status.includes('✅') || status.includes('❌')) {
        sendButton.disabled = false;
        sendButton.textContent = 'Iniciar Novo Disparo';
    }
});