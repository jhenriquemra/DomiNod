<div align="center">
  <img width="280" alt="Logo DomiNod" src="https://github.com/user-attachments/assets/98ddacaf-9b10-4c41-89f2-c07725c8ecf9"/>
  <h1>DomiNod</h1>

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![C](https://img.shields.io/badge/c-%2300599C.svg?style=for-the-badge&logo=c&logoColor=white)
![Arduino](https://img.shields.io/badge/-Arduino-00979D?style=for-the-badge&logo=Arduino&logoColor=white)
![**Projeto Acadêmico**](https://img.shields.io/badge/📚-Projeto%20Acadêmico-success?style=for-the-badge)

---
</div>


O **DomiNod** é um jogo de dominó adaptado e desenvolvido especificamente para pessoas com tetraplegia. O projeto une software e hardware para garantir a acessibilidade, permitindo que o usuário interaja de forma autônoma com o jogo através de comandos físicos adaptados.

---

## 🕹️ Mecânica de Controle e Funcionamento

O sistema de controle foi projetado para responder a movimentos específicos do usuário, eliminando a necessidade do uso tradicional das mãos ou de grande força física:

* **Movimento para os lados (Esquerda / Direita):** Comandos utilizados para navegar entre as peças disponíveis e selecionar as opções no menu do jogo.
* **Inclinação para frente:** Comando utilizado para confirmar a ação e jogar a peça selecionada no tabuleiro.

---

## 💻 Tecnologias Utilizadas

O desenvolvimento do projeto é estruturado da seguinte forma:

**Frontend:**
* **HTML e CSS:** Utilizados para a construção da interface do jogo de dominó em si e toda a sua parte visual.
* JavaScript (JS): É o "motor" do jogo no navegador. Responsável por executar as regras do dominó, controlar a movimentação das peças na tela, gerenciar a inteligência artificial dos adversários e traduzir os comandos de navegação em ações visuais.

**Backend e Hardware:**
* **Python com Flask e C:** Utilizados no desenvolvimento da lógica do sistema, integração com o Arduino, processamento de dados e comunicação entre os sensores de movimento e a interface do jogo.
* **Arduino:** Plataforma de hardware utilizada para captar as inclinações e comandos físicos do usuário.
---

## ✨ Funcionalidades do Jogo

* Interface gráfica adaptada para navegação linear e simplificada.
* Integração direta entre o hardware dos sensores e a resposta visual na tela.
* Regras e lógica do jogo clássico de dominó adaptadas ao sistema de acessibilidade.

---

## 📁 Estrutura do Projeto

Abaixo está a organização atual dos arquivos e diretórios do projeto:

```text
DomiNod/
│
├── assets/                  # Imagens, ícones e recursos visuais
│   ├── favicon.ico
│   └── logo_dominod.png
│
├── css/                     # Arquivos de folha de estilo
│   └── style.css
│
├── js/                      # Scripts do lado do cliente (Front-end)
│   └── script.js
│
├── setup                    # Integração Arduino e scripts de controle
│   ├── controle.py          # Script em Python para controle/comunicação
│   └── sensor.ino           # Código fonte do Arduino (Sketch)
│
├── .gitignore               # Arquivos e pastas ignorados pelo Git
├── about.html               # Página "Sobre"
├── index.html               # Página principal do projeto
├── requirements.txt         # Dependências do Python
└── README.md                # Documentação do projeto
```
