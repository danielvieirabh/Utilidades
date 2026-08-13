import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import subprocess
import os
import threading
import re

def selecionar_arquivo():
    """Abre a pasta do computador para escolher o vídeo."""
    caminho = filedialog.askopenfilename(
        title="Escolha o vídeo",
        filetypes=[
            ("Arquivos de Vídeo", "*.webm *.mkv *.avi *.mov *.flv *.mp4 *.wmv"), 
            ("Todos os arquivos", "*.*")
        ]
    )
    if caminho:
        lbl_arquivo_selecionado.config(text=caminho)
        btn_converter.config(state=tk.NORMAL)
        # Reseta a barra de progresso
        progresso_var.set(0)
        lbl_status.config(text="Pronto para converter.")
        
        global arquivo_escolhido
        arquivo_escolhido = caminho

def iniciar_conversao():
    """Muda o status do botão e envia a conversão para o plano de fundo."""
    btn_converter.config(state=tk.DISABLED, text="⏳ Processando...")
    btn_escolher.config(state=tk.DISABLED)
    lbl_status.config(text="Calculando tempo do vídeo...")
    progresso_var.set(0)
    
    # Inicia a Thread para não congelar o painel
    threading.Thread(target=processar_conversao, daemon=True).start()

def converter_tempo_para_segundos(tempo_str):
    """Converte o formato HH:MM:SS.ms do FFmpeg para segundos puros."""
    try:
        h, m, s = tempo_str.split(':')
        return int(h) * 3600 + int(m) * 60 + float(s)
    except:
        return 0

def processar_conversao():
    """Executa o comando do FFmpeg lendo a saída linha por linha."""
    if not arquivo_escolhido:
        return
    
    nome_base = os.path.splitext(arquivo_escolhido)[0]
    arquivo_saida = f"{nome_base}_convertido.mp4"
    
    comando = [
        "ffmpeg", "-y", "-i", arquivo_escolhido,
        "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", arquivo_saida
    ]
    
    # Regex para encontrar os tempos no texto do FFmpeg
    padrao_duracao = re.compile(r"Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)")
    padrao_tempo = re.compile(r"time=\s*(\d{2}:\d{2}:\d{2}\.\d+)")
    
    duracao_total = 0
    
    try:
        # Usamos o Popen para ler a saída de texto do FFmpeg em tempo real
        processo = subprocess.Popen(
            comando,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # O FFmpeg joga os logs no Erro Padrão, então redirecionamos
            universal_newlines=True,
            encoding='utf-8',
            errors='ignore'
        )

        for linha in processo.stdout:
            # 1. Pega a duração total do vídeo logo no início
            if duracao_total == 0:
                match_duracao = padrao_duracao.search(linha)
                if match_duracao:
                    duracao_total = converter_tempo_para_segundos(match_duracao.group(1))

            # 2. Fica lendo o tempo atual sendo convertido para calcular a %
            match_tempo = padrao_tempo.search(linha)
            if match_tempo and duracao_total > 0:
                tempo_atual = converter_tempo_para_segundos(match_tempo.group(1))
                porcentagem = (tempo_atual / duracao_total) * 100
                
                # Evita passar de 100% por causa de decimais
                if porcentagem > 100:
                    porcentagem = 100
                    
                # Atualiza os componentes na tela
                progresso_var.set(porcentagem)
                lbl_status.config(text=f"Convertendo: {porcentagem:.1f}% concluído")

        # Espera o processo terminar 100%
        processo.wait()
        
        if processo.returncode == 0:
            lbl_status.config(text="✅ Conversão 100% concluída!")
            progresso_var.set(100)
            messagebox.showinfo("✅ Sucesso!", f"Vídeo convertido com sucesso!\n\nSalvo em:\n{arquivo_saida}")
        else:
            raise subprocess.CalledProcessError(processo.returncode, comando)
            
    except FileNotFoundError:
        messagebox.showerror("❌ Erro", "O programa 'ffmpeg' não foi encontrado no seu Linux.\nInstale com: sudo apt install ffmpeg")
        lbl_status.config(text="Erro: FFmpeg não instalado.")
    except Exception as e:
        messagebox.showerror("❌ Erro", "Ocorreu um erro durante a conversão do arquivo.")
        lbl_status.config(text="Erro na conversão.")
    finally:
        # Libera os botões novamente
        btn_converter.config(state=tk.NORMAL, text="⚙️ Converter para MP4")
        btn_escolher.config(state=tk.NORMAL)

# ==========================================
# DESIGN DO PAINEL (INTERFACE GRÁFICA)
# ==========================================

app = tk.Tk()
app.title("Conversor de Vídeo para MP4")
app.geometry("550x330") # Aumentei um pouco a altura para caber a barra
app.configure(bg="#1e1e1e")
app.resizable(False, False)

arquivo_escolhido = ""

# Estilos e Cores
fonte_titulo = ("Helvetica", 16, "bold")
fonte_normal = ("Helvetica", 11)
bg_color = "#1e1e1e"
cor_texto = "#ffffff"
cor_destaque = "#bb86fc"
cor_sucesso = "#03dac6"

# Componentes da Tela
titulo = tk.Label(app, text="🎬 Conversor Universal MP4", font=fonte_titulo, bg=bg_color, fg=cor_destaque)
titulo.pack(pady=15)

btn_escolher = tk.Button(
    app, text="📂 Escolher Vídeo da Pasta", font=fonte_normal, 
    command=selecionar_arquivo, bg="#333333", fg=cor_texto, 
    relief="flat", activebackground="#444444", activeforeground="white",
    padx=15, pady=8, cursor="hand2"
)
btn_escolher.pack(pady=5)

lbl_arquivo_selecionado = tk.Label(
    app, text="Nenhum arquivo selecionado.", font=("Helvetica", 9), 
    bg=bg_color, fg="#888888", wraplength=500
)
lbl_arquivo_selecionado.pack(pady=5)

# --- NOVO: Área de Progresso ---
lbl_status = tk.Label(app, text="Aguardando arquivo...", font=("Helvetica", 10, "bold"), bg=bg_color, fg="#ffca28")
lbl_status.pack(pady=(10, 0))

progresso_var = tk.DoubleVar()
barra_progresso = ttk.Progressbar(app, variable=progresso_var, maximum=100, length=400, mode='determinate')
barra_progresso.pack(pady=10)
# -------------------------------

btn_converter = tk.Button(
    app, text="⚙️ Converter para MP4", font=fonte_normal, 
    command=iniciar_conversao, state=tk.DISABLED, 
    bg=cor_sucesso, fg="#000000", relief="flat", 
    activebackground="#01a396", activeforeground="black",
    padx=15, pady=8, cursor="hand2"
)
btn_converter.pack(pady=10)

app.mainloop()