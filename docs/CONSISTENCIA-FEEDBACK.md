# Consistência entre status e execução informada

Base: fix/ciclo-prescricao-aluno, commit 5273a3e5eae1671e95bdf2861b6c18fca47fd410.
Correção: branch fix/consistencia-feedback. Não houve acesso ou alteração ao Apps Script/Sheets da versão 14.

## Causa reproduzida

O endpoint submitItemFeedback validava separadamente status, intervalo numérico, unidade e revisão, sem cruzar o status not_done com a dose executada. O formulário também aceitava essa combinação. Assim, Não realizado com 2 séries e 2 repetições podia ser gravado. A ação Concluir copiava as quantidades anteriores para uma nova revisão; preservar os valores reais é correto, mas faltava esclarecer que concluir não significa ter cumprido integralmente a dose prescrita.

## Regra aplicada a novas gravações e correções

| Status | Séries/blocos e quantidade executados |
| --- | --- |
| Não realizado (not_done) | Cada quantidade deve ser zero ou ausente. Qualquer valor positivo é rejeitado com INVALID_DATA. |
| Parcial (partial) | Preserva os valores declarados, inclusive quantidades não informadas; não completa automaticamente a dose. |
| Concluído (completed) | Encerramento informado pelo aluno, sem comprovação automática de cumprimento integral; preserva quantidades declaradas ou ausentes. |

Os limites, unidades, aplicabilidade de campos/RPE e revisão esperada continuam sendo validados. Ausente significa campo não enviado; não aceita string vazia ou null como número. Quantidade zero, quando enviada, ainda exige sua unidade correta. Dor e comentário podem ser registrados em Não realizado. Não se deduz nem se altera o status automaticamente pela comparação com o volume prescrito.

A regra de not_done roda no servidor antes de persistRecord_, sem criar reservas ou linhas em caso de rejeição. O formulário alinha os limites e a validação HTML ao status e apresenta orientação específica. Trocar para Não realizado não apaga nem zera valores preenchidos: o aluno deve corrigir as quantidades ou selecionar Parcial. Trocar novamente de status restaura os limites normais. A validação do servidor permanece obrigatória mesmo que o cliente seja contornado.

O aluno vê a quantidade efetivamente informada separada da prescrição. O progresso conta exercícios **marcados** como concluídos e não dose cumprida. A confirmação de conclusão e o retorno ao treinador esclarecem que encerramento informado não comprova execução integral. Não se preenche automaticamente 5 séries/15 repetições porque o aluno marcou Concluído.

## Histórico e compatibilidade

Não há migração, limpeza ou normalização das linhas já existentes. Uma revisão antiga contraditória continua consultável exatamente com seus valores, timestamps e IDs. Ao abri-la para editar, a interface mostra os valores anteriores e aponta a inconsistência; uma nova gravação precisa atender à regra corrigida. O aluno pode registrar Parcial com os valores reais ou informar zero/ausência se realmente não realizou o exercício, gerando nova revisão. A ação Concluir pode encerrar com 2/2 informados, sem transformar esses números na dose integral.

expectedRevision, supersedesId, requestId, fingerprints e ScriptLock permanecem. Correções válidas acrescentam revisões; duplicatas idempotentes não acrescentam linhas; revisões antigas e prescrições não são sobrescritas. Registros legados com ItemPrescription seguem o mesmo cruzamento status/dose nas novas gravações e mantêm sua semântica de quantidade por série. As novas prescrições da biblioteca mantêm o total executado conforme a correção anterior.

## Arquivos e testes

- Operacionais: apps-script/Student.gs, apps-script/Student.html e apps-script/Index.html.
- Fontes: student/app.js e student/template.html; student/build.py regenerou Student.html e demo/student.html.
- Testes: tests/feedback-state.test.cjs e ampliação de tests/prescription-cycle-browser.py; tests/helpers/coach-browser-server.cjs permite somente no servidor localhost inserir uma revisão fictícia anterior à correção.

`node --test tests/*.test.cjs`: **111 testes aprovados, zero falhas**, sendo seis novos casos que exercitam matrizes de combinações em prescrições legadas e estruturadas. Incluem Não realizado com quantidades positivas/mistas/zero/ausentes; a reprodução 2/2 com dor 3 e comentário fadiga; Parcial/Concluído sem inferência de 5×3; validação de tipos/unidades; idempotência e conflitos; preservação byte a byte de revisão antiga e correções append-only.

`python tests/prescription-cycle-browser.py`: **nove grupos de verificações aprovados** em Chromium local. O navegador abre o Student.html gerado e confirma bloqueio antes de RPC sem limpar valores; alteração para Parcial; conclusão com 2/2 preservados, com aviso também no treinador; Não realizado com zero e com campos em branco; integridade de todas as revisões anteriores. Mantém os testes do ciclo completo, isolamento e recuperação de escritas parciais.

Os serviços Google e os dados dessas execuções são exclusivamente fictícios, em memória. A revisão histórica é uma fixture de teste, não uma alteração na planilha de homologação. Os nove testes Python do comparador devem passar após fixar o pacote desta correção no manifesto; comparação de código não comprova implantação real.

## Atualização manual futura e homologação pendente

Nenhuma implantação foi feita. No projeto isolado de homologação equivalente à base, o proprietário precisará atualizar **Student.gs (ou o nome existente StudentLogic.gs, sem duplicação), Student.html e Index.html**, conferindo o pacote fixado em docs/biblioteca/REFERENCIA-SINCRONIZACAO.json. Preservar Backend.gs, OAuth, biblioteca, propriedades e planilhas. Não copiar arquivos de teste para o Apps Script nem executar inicialização/migração.

Com dados fictícios independentes, validar no Apps Script real:

1. Não realizado com 2/2: bloqueio na interface e INVALID_DATA em chamada direta; nenhuma nova linha de feedback ou reserva.
2. Não realizado com zero ou quantidades ausentes: salvar, preservando dor 3/10 e comentário fadiga.
3. Parcial com 2/2: salvar e consultar no treinador. Concluir depois: nova revisão, mesmos valores 2/2, sem preenchimento da prescrição 5×3 e sem alegação de dose integral.
4. Consultar um registro antigo contraditório sem alterá-lo. Se o usuário decidir corrigi-lo, conferir a nova revisão e a preservação da anterior.
5. Validar replay, revisão concorrente e bloqueio em duas sessões Google, além do comportamento nativo dos campos no Safari/iPhone.

OAuth real, persistência no Google Sheets, concorrência no Apps Script e navegadores móveis permanecem pendentes nesta entrega. Não foram modificadas produção, homologação, credenciais, tabelas, campos persistentes ou endpoints.
