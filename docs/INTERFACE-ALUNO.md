# Nova interface do aluno

## O que foi implementado

A tela usa a referência fornecida: azul #1769F5, azul escuro #123E78, verde #22A052, fundo #F5F7FB, informações #EAE8FF, cartões brancos, texto #182438 e bordas de apoio #AAB7CC. Usa Inter local na demonstração e fallback sans-serif no HTML Apps Script. O header tem fotografia ilustrativa de escalada e símbolo de montanha; não é a mesma fotografia da referência. O layout mantém o conteúdo real da tela, sem desenhar uma moldura de iPhone ou status de bateria fictícios.

Datas exibem somente sessões devolvidas por listWorkouts. Dias são ordenados/deduplicados; múltiplas sessões no mesmo dia possuem seletor adicional. Selecionar uma data carrega objetivo, orientações, exercícios e histórico daquela sessão, com proteção contra respostas atrasadas. Estado vazio aparece quando não há treino autorizado.

Cartões nativos details/summary permitem vários exercícios abertos. O segundo começa expandido quando existe, seguindo a referência. A ordenação usa position; itens legados mantêm a sequência das linhas quando não têm prescrição estruturada. Séries/descanso/intensidade ausentes são apresentados como não informados. Nunca converter implicitamente segundos de suspensão em repetições ou intensidade em RPE.

Os dois cronômetros são independentes. Exercício usa accumulated + (Date.now - startedAt); descanso usa endsAt - Date.now, limitado a zero. Intervalos apenas redesenham a tela; visibilitychange/pageshow atualizam após suspensão. Trocar exercício/data não perde os tempos. Pausar/zerar não salva feedback nem conclui exercício. O descanso não altera a prescrição. Não há alerta sonoro/background notification garantido. Se o sistema encerrar a aba ou ela for recarregada, os tempos em memória se perdem; o requisito atendido é suspensão/bloqueio enquanto a aba é preservada, pendente de teste real Safari.

Feedback é específico de item. RPE só aparece se rpeApplicable; séries executadas só se houver séries prescritas; dose executada usa a unidade da prescrição e é registrada como quantidade por série. O MVP não modela neste estágio cada série executada com valores distintos: um registro contém número de séries e dose por série. Concluir exige confirmação, cria feedback completed e não altera Workouts nem conclui a sessão. Correção cria revisão nova; histórico anterior permanece. O aluno pode corrigir enquanto estiver ativo e tiver acesso ao próprio treino; treinador consulta, mas não altera feedback de aluno. Conflitos exigem atualizar antes de uma nova correção.

## Modelo aditivo

As colunas de Users, Links, Workouts, Items, Feedback e Requests permanecem iguais. Três abas novas:

| Aba | Campos |
| --- | --- |
| WorkoutGuidance | id (mesmo UUID do treino), workoutId, steps (array JSON de até 20 orientações) |
| ItemPrescription | id (mesmo UUID do item), itemId, workoutId, position, sets, quantity, quantityUnit, restSeconds, intensityMin, intensityMax, intensityUnit, intensityText, rpeApplicable |
| ItemFeedback | id, workoutId, itemId, studentId, status, rpe, fingerPain, comment, actualSets, actualQuantity, quantityUnit, revision, supersedesId, createdAt |

Não há migração automática. getWorkout funciona com abas complementares ainda ausentes; usa dados legados e não inventa séries/intervalos/RPE. Para escrever o novo modelo, o administrador executa initializeSchema_ na planilha **de homologação**, criando somente abas ausentes e verificando cabeçalhos. A carga fictícia antiga recusa repetir em tabelas com registros; não usá-la para adaptar planilhas existentes.

createWorkout aceita instructions opcional. addItem aceita prescription opcional. Campos estruturados também estão no formulário do treinador em Index.html (habilitar a opção de prescrição estruturada). quantityUnit admite repetitions, seconds, hang_seconds, minutes, meters, attempts e moves. Intensidades: RPE, kg, %1RM, %bodyweight, grade ou other; valores numéricos podem ser faixa min/max, e grade/other usam texto explícito. RPE percebida é separada da intensidade prescrita. Novos itens com prescrição explícita não podem repetir position de outro item com prescrição explícita do mesmo treino.

Novo RPC autenticado submitItemFeedback, requestId e data:

```json
{"workoutId":"uuid-treino","itemId":"uuid-item","status":"completed","fingerPain":0,"rpe":7,"comment":"Exemplo fictício","actualSets":4,"actualQuantity":6,"quantityUnit":"hang_seconds","expectedRevision":0}
```

status: completed/partial/not_done. rpe, comment e medidas executadas são opcionais; dor 0–10 é obrigatória. RPE 1–10 inteiro quando aplicável. Unidades executadas precisam coincidir com a prescrição. Os três IDs de vínculo são verificados no servidor; studentId vem exclusivamente da sessão autenticada. expectedRevision é 0 no primeiro registro e a revisão corrente na correção. Repetição da mesma requestId/conteúdo devolve o registro original; outra requisição com revisão antiga retorna CONFLICT. Reservas Requests e ScriptLock protegem gravações, incluindo retomada de suplemento após falha parcial. Sheets não oferece transações ACID; se uma gravação de suplemento falhar, retomar com a mesma chave após corrigir a causa. Entidade base já escrita pode aparecer com fallback legado até a retomada.

getWorkout devolve instructions, items ordenados com prescription e itemFeedback com histórico autorizado. Feedback da sessão anterior continua em Feedback, separado dos registros individuais. Não existe atualização automática de status da sessão.

## Builds, acesso e demonstração

Fontes: student/template.html, style.css, model.js, app.js, google-adapter.js e demo-adapter.js. Gerar:

```sh
python3 demo/build.py
python3 student/build.py
node --test tests/*.test.cjs
```

Arquivos gerados: demo/index.html (demonstração anterior/treinador), demo/student.html (nova tela simulada), apps-script/Student.html (nova tela com OAuth e RPC). Copiar também Student.gs para o projeto Google junto a Backend.gs, Auth.gs, Homologation.gs, Index.html e manifesto. O /exec abre a nova tela do aluno; /exec?view=coach preserva a interface do treinador. O cliente OAuth continua usando exatamente o /exec base como callback; não alterar redirect para a query view. A identidade e os escopos permanecem conforme AUTENTICACAO-GMAIL.md. Nenhum projeto Google é implantado nesta entrega.

Hospedagem da demonstração: raiz do Site abre a nova tela; coach.html preserva a demo anterior. Os armazenamentos das duas demonstrações são separados e reiniciam na navegação/reload. A demonstração do aluno possui datas fictícias 02/04/06/08 de setembro e perfis A, B e Sem treinos. Está isolada do OAuth/Sheets; não inserir dados reais. student/assets registra origem/licenças dos recursos visuais.

## Evidências e pendências de verificação

40 testes Node passaram: datas/ordem, cálculos por timestamps, pausa/retomada/zero, descanso independente, unidades, estado visual derivado do feedback, validação/autorização, correções, idempotência, contenção de lock simulada, recuperação de suplementos e compatibilidade legada. Expansão usa comportamento nativo details; os testes verificam a estrutura e o armazenamento de expansão. Regras CSS de toque, fontes 16px de formulário e reorganização em duas colunas são verificadas estaticamente. Os testes não renderizaram a tela nem executaram eventos em um navegador real.

Falta homologação manual em Safari/iPhone (320/375/390/430 px) e desktop: comparar cores/espaçamento com a referência, rolar datas horizontalmente, expandir múltiplos cartões, completar/corrigir feedback, teclado e rolagem dos modais, retorno de bloqueio de tela e contagem real por timestamps. Verificar contraste/zoom 200%, foco e VoiceOver. Não foi possível executar QA visual porque a ferramenta de navegador do ambiente não está disponível. No Google: inicialização aditiva com cópia fictícia, OAuth de três Gmail, listagem autorizada, persistência, disputa real de lock e conflitos entre duas sessões. Não confundir testes simulados com esses resultados pendentes.
