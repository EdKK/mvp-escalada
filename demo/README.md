# Demonstração visual independente

Abrir index.html em um navegador ou hospedar somente esse arquivo estático. Não precisa de instalação, Google Cloud, login ou conexão a planilha. No iPhone, preferir o endereço hospedado: o app Arquivos pode mostrar apenas uma prévia sem executar JavaScript.

Perfis: Treinador Demo, Aluna A Demo e Aluno B Demo. Criar treino como treinador, adicionar um item ao treino selecionado, trocar para o aluno correspondente, enviar retorno e voltar ao treinador para consultar. O botão Reiniciar demonstração restaura os dados fictícios. Recarregar também restaura tudo. Não inserir dados reais.

A cópia preserva o CSS/formulários da versão Apps Script, adicionando apenas a barra de demonstração e os controles de perfil. demo/build.py gera o HTML único a partir dos arquivos mantidos em apps-script/. O simulador reaproveita as regras de acesso e validação de Backend.gs e as fixtures de Homologation.gs, com Sheets/identidade em memória. Não inclui Auth.gs, credenciais, chamadas Google ou canais de sincronização legados.

Reconstruir: python3 demo/build.py. Testar: node --test tests/*.test.cjs. São testes de simulação e estrutura, sem comprovação visual em Safari nem autenticação/persistência Google. A hospedagem da demonstração é independente do site original; não é implantação do aplicativo Apps Script.


Demonstração hospedada: https://mvp-escalada-demo-visual.kacaaranha.chatgpt.site

Site independente no Sites, privado ao proprietário: no iPhone usar a mesma conta ChatGPT que criou a demonstração. Não há autenticação Google real dentro da demo. Não houve teste visual em Safari neste ambiente; 28 testes locais de lógica/estrutura passaram.
