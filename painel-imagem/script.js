const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageLoader = document.getElementById('imageLoader');
const textInput = document.getElementById('textInput');
const addTextButton = document.getElementById('addTextButton');
const secretMessage = document.getElementById('secretMessage');
const hideButton = document.getElementById('hideButton');
const revealButton = document.getElementById('revealButton');
const resultDiv = document.getElementById('result');

let originalImage = null;

// 1. Carregar e desenhar a imagem no canvas
imageLoader.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height); // Salva estado original
            resultDiv.textContent = 'Imagem carregada.';
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

// 2. Adicionar texto sobre a imagem
addTextButton.addEventListener('click', () => {
    if (!originalImage) {
        alert('Por favor, carregue uma imagem primeiro.');
        return;
    }
    const text = textInput.value;
    ctx.font = '30px Arial';
    ctx.fillStyle = 'red';
    ctx.fillText(text, 40, 50); // Posição (x, y) do texto
    resultDiv.textContent = 'Texto adicionado. Você pode salvar a imagem agora.';
});

// Delimitador para saber onde a mensagem secreta termina
const DELIMITER = '$$STEGEND$$';

// 3. Esconder mensagem na imagem (Esteganografia LSB)
hideButton.addEventListener('click', () => {
    if (!originalImage) {
        alert('Por favor, carregue uma imagem primeiro.');
        return;
    }
    
    // Restaura a imagem original para não esconder mensagem sobre mensagem
    ctx.putImageData(originalImage, 0, 0);

    const messageToHide = secretMessage.value + DELIMITER;
    if (messageToHide.length === DELIMITER.length) {
        alert('Digite uma mensagem para esconder.');
        return;
    }

    // Converte a mensagem para binário
    let binaryMessage = '';
    for (let i = 0; i < messageToHide.length; i++) {
        binaryMessage += messageToHide[i].charCodeAt(0).toString(2).padStart(8, '0');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data; // Array [R, G, B, A, R, G, B, A, ...]

    // Verifica se a imagem tem espaço suficiente
    if (binaryMessage.length > data.length) {
        alert('A mensagem é muito grande para esta imagem.');
        return;
    }

    // Esconde cada bit da mensagem no LSB (Least Significant Bit) de cada componente de cor
    let dataIndex = 0;
    for (let i = 0; i < binaryMessage.length; i++) {
        // Ignora o canal Alpha (transparência)
        if ((dataIndex + 1) % 4 === 0) {
            dataIndex++;
        }
        
        let bit = parseInt(binaryMessage[i]);
        // Altera o LSB do valor da cor
        if ((data[dataIndex] % 2) !== bit) {
            data[dataIndex] = (data[dataIndex] & 0xFE) | bit; // Zera o LSB e aplica o bit
        }
        dataIndex++;
    }

    ctx.putImageData(imageData, 0, 0);
    resultDiv.textContent = 'Mensagem escondida com sucesso! Salve a imagem para compartilhar.';
});

// 4. Revelar mensagem escondida
revealButton.addEventListener('click', () => {
    if (!originalImage) {
        alert('Por favor, carregue uma imagem para investigar.');
        return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let binaryMessage = '';
    let revealedMessage = '';

    // Extrai o LSB de cada componente de cor
    for (let i = 0; i < data.length; i++) {
        if ((i + 1) % 4 === 0) continue; // Pula o canal Alpha

        binaryMessage += (data[i] % 2).toString();

        // A cada 8 bits, converte para um caractere
        if (binaryMessage.length === 8) {
            const charCode = parseInt(binaryMessage, 2);
            revealedMessage += String.fromCharCode(charCode);
            binaryMessage = '';

            // Verifica se encontramos o delimitador
            if (revealedMessage.endsWith(DELIMITER)) {
                resultDiv.textContent = 'Mensagem encontrada:\n\n' + revealedMessage.substring(0, revealedMessage.length - DELIMITER.length);
                return;
            }
        }
    }
    resultDiv.textContent = 'Nenhuma mensagem escondida foi encontrada na imagem.';
});
