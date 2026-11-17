# Responsividade da tela do aluno

O viewport da rota do aluno agora é aplicado por HtmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover'). A tag no arquivo HTML continua útil à demonstração estática, mas o Apps Script precisa configurar a saída HtmlService. Não se bloqueia zoom com user-scalable/maximum-scale.

A auditoria encontrou o limite de 760px e a moldura/margens de desktop ativadas também em celulares em paisagem, além de textos de 10–14px, setas estreitas, flex items sem min-width:0 e rótulos nowrap. Uma camada final em student/style.css remove o limite/moldura, amplia textos e controles, permite quebra de conteúdos longos e usa grids minmax(0,1fr). Só a faixa de datas mantém rolagem horizontal intencional. Há padding de safe-area, sem tentar ocupar áreas reservadas pelo navegador. Modais usam vh como fallback de dvh e rolagem interna; em paisagem curta ficam alinhados ao topo. Campos mantêm no mínimo 16px e botões de ação 44–52px ou mais.

Fontes mantidas em student/style.css. Executar python3 student/build.py atualiza apps-script/Student.html e demo/student.html. Lógica de timers/feedback, adaptadores, OAuth, manifesto, estruturas de Sheets e dados permanecem inalterados. Não há PWA, troca de hospedagem, fullscreen, ocultação das barras Safari ou alteração do aviso de segurança do Google.

## Atualizar a implantação existente do Apps Script

1. Na branch feature/backend-seguro, obter as versões atuais de apps-script/Backend.gs e apps-script/Student.html.
2. No projeto Apps Script existente, substituir apenas o conteúdo dos arquivos Backend e Student. Manter todos os demais arquivos, inclusive OAuthReturn, configurações, propriedades e permissões.
3. Salvar. Em Implantar > Gerenciar implantações, selecionar a implantação existente, clicar no lápis e escolher Nova versão. Implantar mantendo a identidade de execução e a configuração de acesso já usadas.
4. Reutilizar o mesmo deployment ID e URL /exec. Não criar outro cliente OAuth, não alterar redirect URI, não inicializar esquema e não executar carga/migração.
5. Fechar a aba de teste anterior e abrir novamente o mesmo /exec. Como a sessão fica em memória, uma nova entrada OAuth será necessária. Não recarregar a aba original durante uma entrada OAuth em andamento.

## Validação

node --test tests/*.test.cjs verifica a meta de viewport na saída da rota real (com HtmlService simulado), a cascata de declarações de largura para 320/375/390/430px em retrato e 667/844/932/1024px em paisagem, as regras de toque/grids e a atualização dos dois HTMLs gerados. Esses testes são de contrato CSS e lógica, não de renderização. A suíte anterior também verifica timers, feedbacks e controles de acesso.

Pendente em dispositivos reais: Safari iPhone e Chrome Android, com barras de navegador e avisos Apps Script visíveis. Conferir uso da largura, zoom, nomes/notas longos, datas rolando apenas dentro da faixa, cartões sem rolagem lateral da página, teclado/scroll dos modais, rotação durante cronômetro ativo, feedback/correção e login. Não há validação visual automatizada neste ambiente. Nenhuma implantação Google ou hospedagem foi atualizada automaticamente nesta alteração.
