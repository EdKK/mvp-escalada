# Etapa 05 — Integração do treinamento direcionado

## Referências e alcance

A branch `codex/treinamento-direcionado` partiu de `245d5ed590fc402a6793ea446891946f0381df4a`. O checkout original estava limpo na branch local `work`, em `a9eb8c1d1d902d87cda4af9e4eda8ee764ce0b49`. Após a autorização de preparo, foi recuperada a referência da branch de desenvolvimento e o novo checkout foi vinculado a ela. O GitHub e o HEAD local apontavam para o commit autorizado, com 0 commits à frente e 0 atrás. O candidato é o commit de desenvolvimento que contém este relatório.

A comparação usa a v19 informada, `5e13ba78b6256a51531be8d7f3e0b1081b16e323`. A correspondência da v19 com a implantação real ainda depende de exportação pelo Work. Os três commits anteriores introduziram Fingerboard, blocos de tração e Campus Board. O servidor calcula o volume, registra o contrato versionado em `snapshotJson.directed` e grava a dose por série. O treinador reabre e revisa a prescrição no mesmo item. O aluno recebe a revisão efetiva e o Campus Board desenha os passos do snapshot. O feedback guarda a identificação da prescrição e as séries enviadas na reserva de `Requests`, associadas ao registro de `ItemFeedback`.

A Etapa 05 mudou `apps-script/Student.gs`, seus dois consumidores gerados em `demo/`, os testes `tests/fingerboard.test.cjs` e `tests/fingerboard-browser.py` e este relatório. O caminho rápido de reenvio do feedback direcionado aceitava a primeira reserva ou linha encontrada mesmo quando havia duplicatas. Agora, duplicidade de reserva resulta em `CONFLICT` e duplicidade do registro de feedback resulta em `SCHEMA_ERROR`, em conformidade com a persistência compartilhada. O teste injeta as duas situações no armazenamento em memória e confirma que o reenvio volta a devolver o mesmo registro quando a duplicidade é removida.

## Resultados simulados

| Modalidade na mesma sessão | Prescrição | Total | Completa | Parcial | Não realizada |
|---|---|---:|---|---|---|
| Fingerboard — suspensão | 3 × 4 × 7 s | 84 s | 84 s | 3 s, esforço incompleto | 0 s |
| Fingerboard — tração | 3 × 5 | 15 repetições | 15 repetições | 2 repetições | 0 repetições |
| Blocos de tração | 12,5 kg, 3 × 4 × 7 s | 84 s | 84 s | 3 s, esforço incompleto | 0 s |
| Campus Board — CB04 | 3 × 2 × 8 movimentos | 48 movimentos | 48 movimentos | 11 movimentos, 3 adicionais | 0 movimentos |
| Campus Board — botes duplos | 3 × 2 × 3 botes | 36 movimentos | 36 movimentos | 9 movimentos, 3 adicionais | 0 movimentos |

O teste integrado conferiu o mesmo TreinoID, ordem progressiva, reabertura via consulta, edição, o retorno para treinador e aluno, rejeição de séries incompletas ou fora dos limites, dor, observações, zero explícito, identificação da revisão e preservação dos snapshots. Conferiu também o reenvio, a recuperação de BUSY, a rejeição da revisão obsoleta e o isolamento entre alunos. O teste manteve cada volume na própria unidade. O conjunto de regressões cobre falhas de gravação em reservas, itens, prescrições, séries e feedback.

Os fluxos Chromium cobrem edição e reabertura do treinador, a interface do aluno, o cronômetro e o histórico em cenários complementares à sessão de cinco modalidades, que roda pelo RPC simulado em Node. Para CB01–CB08, a suíte Node compara snapshots e volumes com o catálogo esperado. Chromium verifica a mão (E/D), origem, destino, ordem e notação das oito sequências, além do ajuste horizontal em 320 e 390 px. O percurso de botes duplos é exercitado pela interface, incluindo virada, movimentos simultâneos e recusa de trajetória inviável. O grupo verifica a ausência de controles no desenho e de desenho no treinador. A legibilidade em dispositivo físico permanece pendente.

O acervo de regressão inclui os cinco subblocos do Específico e snapshots v1–v3, o fluxo de Treinamento Geral, Direcionado legado, itens sem suplemento e a convivência de Geral, Direcionado legado, Específico e Direcionado com snapshot no mesmo TreinoID. Abrir uma revisão atual preserva o snapshot e o feedback associados à revisão anterior.

| Verificação | Comando | Resultado |
|---|---|---|
| Node | `node --test tests/*.test.cjs` | 154 aprovados |
| Python | `python3 -B -m unittest discover -s tests -p 'test_*.py'` | 9 aprovados |
| Chromium via Playwright | `python3 -B` com cada arquivo `tests/*-browser.py` | 39 grupos aprovados, distribuídos em 13 de layout, 13 de Direcionado, 9 de ciclo e 4 de Específico |
| Builds | `python3 demo/build.py` seguido de `python3 student/build.py`, duas vezes | SHA-256 idêntico entre execuções |

## Arquivos para comparação e futura atualização pelo Work

A ordem de preparação abaixo segue as dependências entre módulos. Fazer a troca em uma única versão do projeto, após comparar o conteúdo exportado e verificar as dependências. Preservar a implantação existente e o seu ID. A lista presume que o código atualmente instalado equivale à v19 e deve ser reconciliada com a exportação real.

| Ordem | Arquivo no GitHub | Nome no editor | Dependência ou responsabilidade |
|---|---|---|---|
| 1 | `apps-script/TrainingLoad.gs` | TrainingLoad | Cálculo, catálogo e validação das tarefas, com funções compartilhadas de TrainingCatalog e TrainingLibrary |
| 2 | `apps-script/CoachLibrary.gs` | CoachLibrary | Prescrição e retomada do treinador, usando persistência de TrainingLibrary e validação de TrainingLoad |
| 3 | `apps-script/TrainingLibrary.gs` | TrainingLibrary | RPC de biblioteca, defs do Direcionado, lock e persistência |
| 4 | `apps-script/Student.gs` | Student ou StudentLogic | Hidratação e feedback. Preservar o nome instalado e manter um único módulo |
| 5 | `apps-script/Index.html` | Index (HTML) | Cliente do treinador, consumindo Backend e TrainingLibrary |
| 6 | `apps-script/Student.html` | Student (HTML) | Cliente gerado do aluno, consumindo Backend e a lógica de Student |

`Auth.gs`, `Backend.gs`, `Homologation.gs`, `TrainingCatalog.gs`, `OAuthReturn.html` e `appsscript.json` são idênticos à v19. As fontes `student/`, a demonstração e os testes são locais. O Apps Script recebe somente os módulos e HTMLs listados. A Etapa 05 não acrescenta dependência de execução. Os scripts de build usam apenas a biblioteca padrão Python. A demonstração permanece isolada com seus perfis e armazenamento fictícios.

As abas existentes continuam com os mesmos cabeçalhos. Os fluxos gravam em `Workouts`, `Items`, `Requests`, `PRESCRICOES`, `PRESCRICAO_SERIES` e `ItemFeedback`. Conferir `ENVIRONMENT=homologation` e o apontamento de `SPREADSHEET_ID` e `LIBRARY_SPREADSHEET_ID` para a mesma planilha de homologação. Validar tabelas e perfis na cópia. A atualização de uma instalação v19 compatível dispensa carga inicial, migração e alteração de OAuth.

O comparador `tools/compare_apps_script.py` e seu manifesto continuam servindo à referência histórica `923f2a0960b7b29e4ef62fc09e69d511bd0c7078`. O indicador `referenceIntact` no checkout do candidato acusa os arquivos que evoluíram desde a referência. Para uma verificação histórica byte a byte, executar o comparador no checkout histórico. Para verificar o candidato, confrontar a exportação com este commit e os hashes abaixo, considerando o alias StudentLogic e registrando diferenças de final de linha separadamente.

```text
67dbb44450f91469440b9e652f03d3248bdc5c1ea64677f8e9202c40b9ae14e8  apps-script/CoachLibrary.gs
1157fd087e59d27269d56278a1f881a0ecffbc1430cd711708c543859806c2a4  apps-script/Index.html
17f30b9b12338c1ebed6c36272d0da27abd24dde350aa375c22e3e4bbd4b9aae  apps-script/Student.gs
645041fa42f0074bbea37de8dcfbd82c60bd0cde957ebe9b8acf0b97db3b16ef  apps-script/Student.html
5ecd3b37bde1fa0acc38fbcbb349c7e86343cb5775c82165cd48043db4d6fdbb  apps-script/TrainingLibrary.gs
1655302e390eefd9120bb9030ccd3efd8e9dba4c5c5dfe55abbbb3422f6055f9  apps-script/TrainingLoad.gs
1df701da5a2b0127da5ca1379befc93b8e8ac855cd7aff5df7f7ac276779119d  demo/index.html
92bcdebfd5b683b5c4e707ee77de9ef634ad087d5ad54b9ddc07ab4e559b31b3  demo/student.html
```

## Reversão e evidência real pendente

Foi feita uma simulação com a lógica da v19 sobre as mesmas linhas geradas pelo candidato. A leitura ainda retornou o total da prescrição e a quantidade escalar de feedback, porém omitiu o contrato Direcionado, as séries executadas e a identificação da revisão no retorno. O reenvio de uma edição direcionada e de feedback com identificação da prescrição foi rejeitado. As linhas permaneceram intactas no ensaio. Essa perda funcional também afeta a apresentação da trajetória, pois a v19 carece do renderizador e do contrato que o alimenta. Trocar somente o código pode ocultar informações e impedir a retomada de operações já iniciadas.

Antes da futura homologação real, exportar o código instalado e registrar ID e versão da implantação, /exec, configuração OAuth e permissões sem copiar segredos para evidências. Fazer uma cópia privada e datada da planilha com todas as abas, cabeçalhos, IDs e contagens. Registrar o ponto de corte e guardar código e dados juntos. Caso seja preciso voltar à v19, suspender as escritas e inventariar os registros e reservas do formato novo. Se existirem, preservar uma cópia posterior ao corte e decidir sobre a restauração coordenada do código e dos dados em cópia isolada ou sobre a correção mantendo o leitor novo. Restaurar o backup da planilha reverte também gravações legítimas posteriores ao corte e exige reconciliação e autorização. Reabrir o acesso após conferir que a versão e a cópia escolhidas preservam o histórico esperado, os perfis e o mesmo /exec.

## Roteiro de homologação para Work e treinador

1. **Work, antes da janela.** Conferir exportação e hashes, cabeçalhos, referências, cópias de segurança e contas fictícias. Confirmar o trecho /exec existente como callback OAuth e /exec?view=coach como rota do treinador. Validar o procedimento de reversão em cópia privada.
2. **Treinador, computador.** Fazer login como treinador. Criar uma única sessão associada ao aluno A, incluir progressivamente as cinco linhas da matriz na ordem apresentada e conferir os totais individualmente. Usar, por exemplo, reglete e meia arqueada no Fingerboard, reglete com lado esquerdo nos blocos e reglete 4,5 cm com mão aberta no Campus. Para botes, usar três botes em subida com dois intervalos. Reabrir a sessão, alterar a orientação de uma prescrição e conferir a revisão e o item original. Confirmar os cinco subblocos do Específico e testar Geral e Direcionado legado.
3. **Aluno A, computador e celular.** Entrar pelo /exec e conferir sessão, ordem, características, valores, descansos e cronômetro em execução, pausa, retomada e após bloquear a tela. Verificar os gráficos e a notação do Campus, inclusive rebotes, junções, subida/descida e botes em ambas as mãos. Conferir foco, rolagem e teclado do feedback, legibilidade em tela estreita, zoom e retorno OAuth no Safari real. Registrar os três estados para cada modalidade, incluindo esforços incompletos, movimentos adicionais, zeros, dor e observações.
4. **Treinador e Work, retorno e Sheets.** Conferir as 15 revisões de feedback, o TreinoID comum, os cinco IDs de item, as séries de cada versão e o encadeamento por `supersedesId`. Comparar `snapshotJson.directed`, `volumeJson` e `Requests.fingerprint` com as doses prescritas e realizadas. Conferir que a revisão anterior mantém os valores históricos, que o treinador recebe dor e observações e que os status preservam zero numérico e o detalhamento ausente quando aplicável.
5. **Work, integridade e recuperação.** Aplicar H01–H14 do protocolo da v19 às contas fictícias. Verificar isolamento do aluno B e o bloqueio de acesso à planilha, papéis e vínculo. Verificar reenvio do mesmo pedido, confirmação de linha única, conflito para revisão vencida, retomada após perda de comunicação e continuidade após BUSY. Em duas sessões independentes, registrar pedidos simultâneos e verificar o resultado em `Requests` e nas tabelas filhas. Considerar BUSY recuperável quando a repetição da mesma intenção conclui com os mesmos IDs e uma única gravação. Sem evidência de contenção real, manter essa verificação pendente. Ensaios de interrupção de escrita com instrumentação exigem cópia isolada.
6. **Work e treinador, decisão.** Aprovar somente com OAuth e isolamento funcionando, histórico e contagens coerentes, recuperação comprovada, endereço preservado e validação em dispositivo real. Interromper diante de identidade incorreta, acesso cruzado, divergência de código, perdas ou duplicatas, valores/unidades divergentes, alteração de /exec ou falha de recuperação. Preservar evidências sem segredos ou dados pessoais e aplicar a decisão de reversão condicionada aos dados.

Permanecem pendentes as verificações reais H01–H14, incluindo OAuth com Gmail no Safari e no computador, identidade e privacidade da planilha, escrita persistente e recuperável, integridade das revisões e concorrência sob LockService real. A v18 registrou um aviso BUSY na carga da biblioteca e a v19 requer conferência direta do código instalado. Os testes em memória e Chromium local sustentam a entrada em auditoria pré-implantação pelo Work. A aprovação de homologação depende da execução e registro do roteiro real.
