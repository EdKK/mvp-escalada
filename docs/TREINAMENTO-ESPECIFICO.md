# Treinamento específico — compatibilidade para o Work

## Candidato após a avaliação da v18

A v18 publicada corresponde a `17278cb55c2aac1dabdff0580326d25fbf32498d`. Este candidato deriva desse commit e está documentado para auditoria em conjunto com o [registro de homologação](HOMOLOGACAO.md) e o [manifesto dos arquivos](biblioteca/REFERENCIA-SINCRONIZACAO.json).

### Tipo de microciclo da sessão

| Ordem | Tipo | Finalidade |
|---|---|---|
| 1 | Introdutório | Adaptação progressiva às cargas |
| 2 | Ordinário | Desenvolvimento regular do desempenho |
| 3 | Choque | Sobrecarga planejada e acentuada |
| 4 | Estabilizador | Consolidação das adaptações |
| 5 | Manutenção | Preservação das capacidades adquiridas |
| 6 | Recuperativo | Redução da fadiga acumulada |
| 7 | Controle | Avaliação do estado de preparação |
| 8 | Pré-competitivo | Preparação imediata para o desempenho |
| 9 | Competitivo | Expressão máxima do desempenho |

A classificação é um atributo da sessão. O formulário exige uma opção e o servidor valida a lista fechada. Na sessão nova, `Workouts.goal` fica vazio. A coluna existente `WorkoutGuidance.steps` contém um objeto JSON com `version: 1`, `microcycleType` e `instructions`, vinculado ao mesmo ID da sessão. A reserva idempotente antecede a gravação do metadado, que antecede a publicação da linha da sessão. A mesma intenção pode retomar a gravação. Na leitura, os vetores históricos de instruções e os objetivos anteriores continuam com o significado original, inclusive se o objetivo tiver o mesmo texto de um tipo. A interface do aluno alterna o rótulo conforme os dados recebidos.

### Identificação e recuperação dos exercícios

No Treinamento específico, saem os controles de Exercício e contexto. O treinador prescreve pelo subbloco e pelas características e dose da tarefa. O servidor aceita `task.version: 3` sem `exerciseId` e sem métrica de entrada. Resolve o nome do exercício e um identificador estável `specific:<subblock>` a partir da classificação validada, sem registro correspondente em `EXERCICIOS`. Os IDs de cada item, prescrição, série e feedback continuam próprios e os vínculos usam os mesmos campos. O snapshot preserva o nome da tarefa e o exercício continua usando repetições como unidade interna. Os contratos das versões 1 e 2 continuam aceitos e os snapshots históricos continuam legíveis.

### Biblioteca e BUSY

A API da biblioteca devolve `BUSY` quando `getScriptLock().tryLock(5000)` falha, antes de abrir as tabelas do catálogo. A API principal também usa esse bloqueio global. Na v18, `catalog` e `listExercises` eram solicitados em paralelo durante a inicialização, portanto podiam disputar o bloqueio entre si e com consultas ou gravações de outras sessões. O erro observado na v18 não identifica qual chamada reteve o bloqueio.

O candidato serializa as duas leituras do catálogo e reaproveita os snapshots já hidratados na consulta do treinador, reduzindo chamadas concorrentes. O aviso fica visível mesmo após salvar uma tarefa. A prescrição específica funciona sem carregar catálogo, exercícios ou indicadores. A gravação ainda requer o bloqueio, a configuração de homologação e as tabelas de prescrição existentes. Se uma gravação receber `BUSY`, deve ser retomada com a mesma intenção. Geral e Direcionado continuam usando o catálogo.

Em homologação, correlacionar horário e duração das execuções de `api` e `libraryApi` com a ação que retornou `BUSY`. Repetir o carregamento isolado e com consultas e gravações simultâneas, identificar a operação que reteve o bloqueio e verificar a configuração e o estado das tabelas se houver códigos de erro de configuração ou esquema. Usar evidências sem tokens, e-mails ou dados pessoais.

### Evidências locais do candidato

Passaram 135 testes Node, 9 testes Python de referência e hashes e 26 grupos de verificações Chromium (4 do fluxo específico, 9 do ciclo de prescrição e feedback e 13 do treinador). Os testes locais simulam falha de aquisição do bloqueio, resposta `BUSY` no carregamento, ausência de tabelas do catálogo e retomada de gravações. Esses cenários comprovam o comportamento local. A causa do incidente real e a homologação funcional do candidato continuam pendentes. O Code Review automático não iniciou por erro de escrita no diretório de estado da CLI. O diff foi revisado localmente.

### Próxima homologação

Comparar a instalação v18 com a referência publicada e atualizar juntos `Backend.gs`, `Student.gs` (ou o alias instalado `StudentLogic.gs`), `TrainingLoad.gs`, `CoachLibrary.gs`, `Index.html` e `Student.html` após auditoria. Conferir os nove tipos, objetivos históricos, os cinco subblocos, criação e recuperação de tarefas, leitura pelo aluno, feedback e regressões de Geral e Direcionado. Verificar integridade, isolamento, concorrência e gravações interrompidas no Google. Antes de reverter após gravações novas, verificar compatibilidade do leitor anterior com os metadados de sessão em objeto e retomadas de prescrições v3. A v18 esperava instruções em vetor e não grava o formato v3.

## Histórico da prescrição simplificada publicada na v18

## Prescrição simplificada

Nesta etapa histórica, a base de desenvolvimento foi o commit `f9fc2089f0caba1c9cb10dd9db0a4df5081db4de` de `feature/treinamento-especifico`, referência da v17 publicada. O [registro de homologação](HOMOLOGACAO.md) reúne os testes manuais informados para a v17 e as verificações pendentes no Google. A seção histórica abaixo descreve o contrato anterior.

O treinador escolhe um dos cinco subblocos e uma tarefa elegível da biblioteca. O formulário exibe grau de dificuldade na escala do subbloco, orientação, inclinação, número de séries, repetições por série, dois intervalos de recuperação e notas. Séries e repetições por série exigem inteiros de 1 a 100. O grau segue opcional, com validação da escala quando preenchido. A recuperação entre repetições conserva o intervalo opcional de 0 a 86.400 segundos inteiros. Para a recuperação entre séries, as opções são 1, 2, 3, 5, 10 e 15 minutos. Zero informado entre repetições e intervalo em branco têm significados distintos.

As faixas da tabela histórica continuam sendo a referência de movimentos efetivos de mão para a classificação metodológica. A prescrição simplificada usa apenas os números de séries e repetições. O servidor grava `task.version: 2` em `snapshotJson`, com `sets`, `repetitionsPerSet` e os intervalos opcionais `restBetweenRepetitionsSeconds` e `restBetweenSetsSeconds`. Reutiliza `volumeJson` e `PRESCRICAO_SERIES` para gravar as repetições prescritas por série e o total aritmético em `unit-repetitions`. A quantidade escalar legada em `Items.quantity` e a duração planejada em `Items.minutes` ficam vazias. Os movimentos por sequência e o volume em movimentos ficam desconhecidos. As tabelas e colunas existentes são reutilizadas.

O aluno vê a dose por série e as duas recuperações. A contagem regressiva existente pode ser acionada para a recuperação entre repetições. O feedback quantitativo opcional registra séries executadas e o total de repetições executadas. Prescrições anteriores continuam a usar suas unidades, distribuição, descanso e feedback históricos. O servidor continua aceitando requisições da versão 1 da tarefa, inclusive nas retomadas de gravações. Prescrições sem tarefa estruturada continuam no fluxo legado.

### Evidências locais desta entrega

- Node (`node --test tests/*.test.cjs`), 131 testes aprovados. Inclui leitura de formatos antigos e novos, validação de série, repetição e intervalos, recuperação de gravação interrompida, repetição idempotente e feedback.
- Python (`python -m unittest discover -s tests -p 'test_compare_apps_script.py'`), 9 testes aprovados. Inclui verificação da referência e dos hashes locais.
- Chromium automatizado, 4 grupos no fluxo específico, 9 no ciclo de prescrição e feedback e 13 no treinador. Os cenários usam serviços e identidades simulados.
- Testes manuais locais e testes no Apps Script para a prescrição simplificada ainda não foram executados. O Code Review automático não iniciou porque o diretório de estado da CLI é somente leitura neste ambiente. O diff foi revisado localmente.

### Próxima homologação

1. Conferir o conjunto instalado contra a v17 de referência e guardar a cópia de reversão. Usar o projeto e os dados de teste da homologação.
2. Após auditoria e autorização, atualizar em conjunto `Index.html`, `TrainingLoad.gs`, `CoachLibrary.gs`, `Student.gs` e `Student.html`. Usar o alias instalado `StudentLogic.gs` se aplicável. Conferir os hashes no [manifesto](biblioteca/REFERENCIA-SINCRONIZACAO.json). Preservar o esquema e as propriedades do projeto.
3. Em uma sessão de teste, gravar exercícios dos cinco subblocos e conferir as faixas, a entrada de grau e séries, os dois intervalos, a reabertura do treino e a leitura de registros anteriores. Conferir quantidade e duração legadas vazias, séries e repetições persistidas e distinção entre intervalo ausente e zero.
4. Validar consulta do aluno, execução e feedback, retorno ao treinador, isolamento, integridade, concorrência, repetição e recuperação de falhas. Conferir Geral e Direcionado. Registrar evidências no Apps Script com contas de teste e sem dados pessoais.
5. Antes de uma reversão após novas gravações, conferir a leitura de tarefas versão 2 e resolver intenções pendentes. O servidor antigo aceita apenas o formato anterior para gravação e retomada. Preservar os registros para auditoria.

---

## Histórico do contrato anterior

## Referência e escopo

Branch `feature/treinamento-especifico`, criada a partir do commit funcional `dcc8fbd9fedecc5239bd98fdb6701b6ed4e48308`. A versão 16 de homologação foi informada pelo usuário; seus arquivos e dados não foram acessados ou comparados nesta implementação. Não houve implantação, inicialização, migração, alteração de OAuth nem acesso a planilhas. A branch de referência e a main foram preservadas.

A mudança organiza somente a seleção do Treinamento específico. Geral e Direcionado preservam seus controles, validações e contratos anteriores. As abas Alunos e Biblioteca não ganharam funcionalidades.

## Auditoria e persistência

Antes da alteração, a sessão já era representada por Workouts e seus exercícios por Items. Items.block e Items.category eram textos do formulário; Items.exercise recebe o exercício escolhido na biblioteca. A classificação `general/directed/specific` já existia na prescrição. Intensidade é estruturada em PRESCRICOES.intensityJson; volume em volumeJson e PRESCRICAO_SERIES. snapshotJson guarda as referências históricas. Não havia representação explícita de orientação, faixa de inclinação ou extensão da sequência.

Reutilizamos a classificação existente como seletor dos três blocos. No novo fluxo específico, Items.block recebe explicitamente `Treinamento específico`. Items.category pode ficar vazio: extensão da sequência não é uma capacidade física nem uma categoria fisiológica. Registros anteriores não são reclassificados.

O contrato existente de salvamento aceita uma propriedade opcional `task`, sem novo endpoint, tabela ou coluna. Exemplo de fragmento de solicitação:

```json
{"task":{"version":1,"subblock":"boulder_short","orientation":"horizontal","wallInclination":"0_15","restSeconds":90}}
```

O servidor valida e persiste a representação canônica em **PRESCRICOES.snapshotJson.task**, incluindo rótulo, limites, escala e definição de movimento. Intensidade permanece em intensityJson/snapshot.intensity; a distribuição de movimentos continua em volumeJson/PRESCRICAO_SERIES. A leitura efetiva do aluno recupera task e disponibiliza seu descanso para o temporizador existente. O treinador recupera as mesmas características pela consulta de prescrições.

Orientação, inclinação, grau e descanso são opcionais e não recebem valores presumidos. Grau omitido é registrado explicitamente como intensidade ordinal não prescrita (`notPrescribed: true`), nunca como V0 ou percentual. Método/protocolo são opcionais somente para a nova tarefa validada; quando fornecidos, continuam sujeitos às relações da biblioteca. snapshot.method pode ser null e methodId vazio. Requisições anteriores sem task mantêm suas exigências anteriores. Isso exige atualizar juntos os leitores e escritores indicados abaixo; não se garante leitura de novas tarefas por cópias antigas da interface.

Os mecanismos existentes de autenticação, autorização, reserva, idempotência e recuperação de séries continuam ativos. Validações ocorrem antes de escrever. Falhas parciais não publicam um item incompleto ao aluno. O snapshot histórico permanece imutável nos testes de recuperação e feedback.

## Regras explícitas

| Subbloco | Movimentos por sequência | Escala |
|---|---|---|
| Boulder curto | 2–6 | Hueco |
| Boulder longo | 7–10 | Hueco |
| Resistência curta | 11–25 | Brasileira |
| Resistência longa | 26–40 | Brasileira |
| Continuidade | 41 ou mais | Brasileira |

A faixa é validada em **cada sequência**, não no volume acumulado da sessão. Sequências diferentes dentro da mesma faixa são permitidas. A quantidade escalar do novo Item também deve respeitar a faixa. Não há classificação fisiológica automática.

Hueco contém V0–V15. Brasileira contém 4º, 4º sup, 5º, 5º sup, 6º, 6º sup e as subdivisões a/b/c de 7 a 12. Não existe conversão entre escalas. Trocar para um subbloco de outra escala limpa o grau incompatível.

Orientações: horizontal (travessia), vertical (ascendente ou desescalada), misto. Inclinações: 0°–15°, acima de 15° até 30°, acima de 30° até 45°, acima de 45°. Zero corresponde à vertical e positivo ao extraprumo. Não se registram paredes positivas/slab. Movimento efetivo inclui juntar a outra mão na mesma agarra e rebotear; a definição é preservada na tarefa.

A seleção reaproveita exercícios ativos de Escalada com indicador ordinal de grau e volume compatível com movimentos efetivos de mão. No catálogo inicial isso permite Boulder e Escalada em via. Não existe correspondência automática de subbloco para exercício, capacidade ou método. Campus board e fingerboard não recebem fórmulas ou classificações artificiais.

## Arquivos e atualização futura de homologação

Operacionais alterados:

- `apps-script/Index.html`: seleção progressiva, campos opcionais e validação próxima dos campos.
- `apps-script/TrainingLoad.gs`: validação e snapshot estruturado da tarefa.
- `apps-script/CoachLibrary.gs`: integração com o salvamento progressivo existente.
- `apps-script/Student.gs`: recuperação compatível da tarefa e descanso.
- `apps-script/Student.html`: artefato regenerado de `student/model.js`, com apresentação mínima das características e suporte a método/grau omitidos.

Também foram atualizados a fonte `student/model.js`, seu artefato `demo/student.html`, testes e documentação. Naquela etapa, o manifesto fixava o commit-fonte e os hashes do conjunto operacional correspondente.

Para futura homologação, comparar primeiro os arquivos instalados com a referência funcional. Se a base for equivalente, atualizar **os cinco arquivos operacionais acima em conjunto**, usando StudentLogic.gs como nome instalado quando esse for o alias atual de Student.gs. Nunca instalar ambos os aliases. Backend.gs, Auth.gs, TrainingLibrary.gs, TrainingCatalog.gs e appsscript.json não precisam de mudanças para este recurso. Preservar propriedades, IDs e planilhas; não executar inicialização. A publicação de uma nova versão de homologação requer autorização separada e não foi realizada aqui.

## Evidências e limites de validação

- Node: 128 testes aprovados, incluindo os 115 anteriores e 13 novos testes de modelo/interface. Cobrem todos os limites solicitados, escalas, orientação/inclinação, persistência/recuperação, múltiplos exercícios, dados antigos, acesso, duplicidade e recuperação após falhas.
- Python: 9 testes de comparação/sincronização aprovados após atualizar os hashes e o commit-fonte do manifesto.
- Chromium local: 13 grupos de regressão do treinador, 9 do ciclo prescrição/feedback e 4 do novo fluxo específico aprovados. O novo fluxo verifica três exercícios na mesma sessão, leitura pelo aluno, feedback parcial e retorno ao treinador, além de larguras 1600/1024/390 sem rolagem horizontal.
- Capturas geradas pelo teste: `/tmp/mvp-especifico-treinador.png` e `/tmp/mvp-especifico-aluno.png`.

Todos os serviços Google, identidades e dados usados nos testes são **simulados/fictícios**. Chromium é um navegador real, mas isso não comprova execução no Apps Script, persistência real no Sheets ou compatibilidade com Safari no iPhone.

Antes de homologar: comparar os arquivos instalados; usar exclusivamente ambiente e planilhas fictícios isolados; criar uma sessão com pelo menos três subblocos; conferir snapshotJson, intensityJson, volumeJson e linhas de séries; recarregar como aluno autorizado; conferir características e temporizador; enviar feedback parcial; recuperar como treinador; testar isolamento entre dois alunos, rejeição sem autenticação, repetição, concorrência e recuperação de gravação interrompida no ambiente real. Conferir treinos antigos e os fluxos Geral/Direcionado. Validar Safari/iPhone e Chrome/Android reais.

## Decisões e pendências metodológicas

Não se calcula carga global, conversão de graus ou capacidade fisiológica a partir da extensão. O descanso é um único intervalo opcional da tarefa em segundos, não uma modelagem nova de pausas por série. A distribuição segue os limites técnicos existentes do volume; continuidade não remove os limites de segurança de entrada. Inclinação registra uma faixa, não um ângulo exato. Campos opcionais permanecem não informados quando omitidos. O catálogo pode ser ampliado futuramente mediante decisão separada; esta etapa não modifica sua semente.

Compatibilidade local demonstrada naquela etapa. O estado publicado e as evidências informadas posteriormente constam no registro de homologação. Recomendação ao Work: revisar os contratos opcionais e o conjunto de cinco arquivos antes de autorizar atualização em homologação. Nenhuma alteração de produção é necessária ou autorizada por esta entrega.
