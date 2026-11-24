# Correção do ciclo de prescrição, execução e feedback

> O ajuste posterior de status/dose e o tratamento de revisões históricas estão em [CONSISTENCIA-FEEDBACK.md](../CONSISTENCIA-FEEDBACK.md).

Base auditada: `feature/layout-biblioteca`, commit `54b66d0cb5dbe7ac3c12f58e30b78b7c2c45c9ae`.
Branch de correção: `fix/ciclo-prescricao-aluno`. Nenhuma implantação, migração, limpeza de dados ou alteração OAuth.

## Comportamento corrigido

`getWorkout` mantém o endpoint e recebe uma adaptação somente de leitura em Student.gs. Para cada item, resolve a prescrição efetiva: a revisão mais recente de PRESCRICOES com todas as suas linhas de PRESCRICAO_SERIES; quando não existe prescrição/reserva da biblioteca, mantém ItemPrescription ou o fallback legado. Não cria suplementos, tabelas ou colunas na consulta. O usuário autenticado continua sendo autorizado por workout_ antes da leitura.

A resposta preserva os campos antigos e acrescenta, nas novas prescrições, `source`, `prescriptionId`, `revision`, `volume`, `series`, `intensity`, `reference`, `snapshot` e `feedbackQuantityScope`. Séries diferentes, blocos/trechos, suspensões e suas durações são entregues integralmente. O campo escalar `quantity` fica vazio quando as doses diferem; não se inventa uma dose uniforme. Avaliação, método, protocolo e intensidade vêm do snapshot histórico, sem recalcular pela avaliação atual nem converter graus em percentuais. Descanso não definido pela nova prescrição permanece não informado.

Reservas existentes identificam itens novos ainda sem prescrição ou revisões sem gravação completa. Faltas de linhas deixam o item invisível ao aluno e impedem seu feedback. Duplicação/inconsistência de linhas, vínculos ou snapshots falha de forma fechada. O treinador conserva acesso ao item reservado para retomar a mesma intenção; `prescriptionPending` é apenas uma informação derivada da leitura, não um estado armazenado ou de publicação. `libraryWrite_`/`libraryRepairChildren_` e os requestIds existentes continuam responsáveis pela recuperação. Consultar nunca completa a escrita automaticamente.

## Feedback e compatibilidade

`submitItemFeedback` conserva os campos existentes e resolve a mesma prescrição efetiva antes de validar. O studentId vem da identidade autenticada. Revisão, requestId, fingerprints, ScriptLock e histórico append-only permanecem.

- **Novas prescrições:** actualQuantity é o **total executado na unidade de volume prescrita**, identificado explicitamente no formulário; actualSets é o número de séries ou blocos executados. Isso permite um resumo inequívoco mesmo quando as séries prescritas diferem. Repetições/movimentos exigem inteiro; tempo/distância podem ser fracionários. Unidade de transporte é normalizada para o vocabulário existente de ItemFeedback; o ID original da unidade permanece em volume/series. Não há registro de execução separado para cada série.
- **Legados:** permanecem os significados anteriores, inclusive quantidade por série e descanso/RPE de ItemPrescription. Nenhum registro antigo é reescrito.
- **RPE:** é aplicável quando a prescrição efetiva contém o indicador int-rpe, principal ou auxiliar; nos legados, respeita rpeApplicable. A referência percentual ou o grau não se transforma em RPE. O formulário atual do treinador não ganha novos controles de RPE auxiliar; esse indicador pode ser registrado pelos contratos já existentes da biblioteca. A ausência do indicador mantém o campo oculto e o servidor rejeita envios indevidos.

O aluno vê método/protocolo, referência individual original e distribuição de todas as séries dentro dos cartões existentes. O treinador passa a ver actualSets e actualQuantity com unidades, inclusive valores zero, junto ao status, dor, RPE e observações. Nenhuma interface secundária foi redesenhada.

## Testes executados

- `node --test tests/*.test.cjs`: **105 aprovados, zero falhas** (92 anteriores e 13 casos integrados novos).
- `python -B -m unittest discover -s tests -p 'test_*.py'`: **9 aprovados, zero falhas**, incluindo o pacote corrigido fixado por hash em eab2f097653120c8f9ad1eec4c143e0c5b76fd0d. O commit posterior de referências não altera os arquivos operacionais.
- `python tests/coach-layout-browser.py`: **12 grupos de verificações aprovados**, regressão do treinador e larguras 390–1920 px.
- `python tests/prescription-cycle-browser.py`: **6 grupos aprovados** em Chromium local, com Index.html e Student.html gerado: prescrição 5×3 a 85% de 100 kg; leitura das cinco séries e referência; feedback quantitativo com resposta perdida e replay sem duplicação; novo login e correção revisionada; consulta pelo treinador; isolamento do segundo aluno; item parcial oculto até recuperação.

Os testes Node adicionais incluem falhas em Requests/Items/PRESCRICOES/PRESCRICAO_SERIES, revisão pendente, inconsistência de linhas, compatibilidade legada, referência substituída, exercício inativo, distribuições heterogêneas, suspensão 168/50 segundos, boulder ordinal, campus descritivo, tempo/distância, RPE condicional, unidades, autorização e concorrência simulada. Usam exclusivamente identidades e tabelas fictícias em memória.

**Esses resultados não comprovam homologação real no Apps Script, OAuth ou Sheets.** O navegador é real, mas seus serviços Google são substitutos locais. Nenhum token/credencial real foi utilizado nos testes.

## Arquivos para atualizar somente na homologação

Se o projeto estiver equivalente à base auditada, atualizar **Backend.gs**, **Index.html**, **Student.html** e **Student.gs**. Se Student.gs está instalado como **StudentLogic.gs**, atualizar esse arquivo e não adicionar outro módulo duplicado. Backend.gs muda somente a passagem do usuário autorizado à hidratação. Auth.gs, manifesto OAuth, Homologation.gs e os quatro módulos da biblioteca não mudaram nesta correção.

1. Pelo proprietário, confirmar projeto e planilha de homologação separados da produção; guardar cópia privada do código instalado, sem propriedades. Não presumir isolamento pelo nome do projeto.
2. Comparar o inventário instalado com o pacote fixado em REFERENCIA-SINCRONIZACAO.json. O manifesto descreve os arquivos operacionais, aceita o alias StudentLogic.gs e aponta para um commit real da correção. Comparar código salvo não comprova a versão implantada. O roteiro SINCRONIZACAO-CONTROLADA.md é histórico.
3. Preservar propriedades OAuth. Conferir as propriedades existentes ENVIRONMENT=homologation, SPREADSHEET_ID e LIBRARY_SPREADSHEET_ID apontando para a mesma planilha de teste, sem expor valores. Não executar inicialização nem carga sobre dados existentes.
4. Copiar os quatro arquivos operacionais, mantendo o nome instalado StudentLogic quando aplicável. Não copiar fontes student/*.js, arquivos de testes ou adaptadores locais ao editor: já estão incorporados em Student.html por `python student/build.py`.
5. Abrir a implantação de teste. Para testar alunos Gmail externos ao projeto, usar a versão de homologação /exec; o proprietário precisa atualizar manualmente somente essa versão quando o código estiver aprovado para teste. Preservar /exec base como callback OAuth; treinador usa ?view=coach e aluno usa a rota padrão. Não alterar implantação de produção.
6. Criar uma nova sessão fictícia como treinador, usando avaliação válida do aluno de teste: supino, 5×3, 85% de 100 kg. Como aluno A, conferir 5 séries, total 15 repetições, alvo 85 kg, protocolo e referência individual. Registrar 4 séries/12 repetições totais, dor e comentário. Conferir no treinador e na linha correspondente de ItemFeedback.
7. Fazer novo login e corrigir feedback: deve acrescentar revisão, mantendo os dados de prescrição. Como aluno B, tentar o ID da sessão de A: acesso negado. Repetir com boulder e suspensão para validar unidades e séries diferentes.
8. Em ambiente descartável fictício, homologar a disputa real de lock, duas abas com revisão concorrente, perda de resposta e recuperação de escrita parcial. Não simular falhas alterando registros históricos reais. Prescrição parcial não deve ser tratada como executável pelo aluno. Registrar evidências sanitizadas, contagens e IDs fictícios.

## Pendências reais e limites preservados

Faltam execução real com as três contas Google, conferência da implantação, persistência no Sheets após novo login, concorrência efetiva e validação em Safari/iPhone. Os testes locais de BUSY não são uma prova de concorrência distribuída no Google. O login continua temporário e F5 exige nova autenticação; cronômetros não passam a ser gravados. As abas visuais Alunos/Biblioteca não ganharam integração. Não há nova publicação, edição/exclusão ou migração. O package.json legado da raiz não foi modificado por estar fora das correções prioritárias.
