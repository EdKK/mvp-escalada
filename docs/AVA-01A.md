# AVA-01A — Avaliação antropométrica

## Referência e candidato

A branch `ava-01a-avaliacao-antropometria` parte diretamente de `a92d498cf983bb989ac9653d3bb16ff569c4fcbd`. O commit corresponde à v32 informada no escopo e à ponta de `origin/bib-14b-exercicios-preventivos`. A inspeção das branches remotas antes do desenvolvimento encontrou somente essa branch contendo o commit e nenhum descendente publicado. `origin/main` estava em `a9eb8c1d1d902d87cda4af9e4eda8ee764ce0b49`, ancestral da referência. `git fsck --no-dangling` concluiu sem erros. A revisão deste relatório é o próprio commit candidato.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `apps-script/Assessment.gs` | Novo catálogo, log, leitura histórica, autorização, RPC e inicializador privado |
| `apps-script/Index.html` | Cartão Avaliação na aba Alunos, integrado à seleção do aluno |
| `student/assessment-form.html` | Formulário de autorrelato e orientação de mensuração |
| `student/assessment-intent.js` | Reenvio idempotente compartilhado pelas duas interfaces |
| `student/template.html`, `student/build.py`, `student/google-adapter.js` | Integração do formulário e da API autenticada ao build do aluno |
| `apps-script/Student.html` | Build gerado para Apps Script |
| `tests/assessment.test.cjs`, `tests/assessment-browser.py` | Casos automatizados com dados fictícios |
| `tests/helpers/gas.cjs`, `tests/helpers/coach-browser-server.cjs` | Suporte simulado à nova API, datas, formatação e perda de resposta |
| `tests/coach-ui.test.cjs`, `tests/coach-layout-browser.py`, `tests/initialization-visibility.test.cjs` | Atualização de verificações da interface e das funções públicas |
| `docs/AVA-01A.md` | Relatório técnico e procedimentos |

## Esquema

As duas abas ficam na planilha privada usada pelo backend. Os nomes seguem as demais abas do projeto e os cabeçalhos estão na ordem física abaixo.

| Aba | Colunas |
| --- | --- |
| `CATALOGO_AVALIACAO` | `id`, `name`, `dimension`, `nature`, `unit`, `dataType`, `protocol`, `allowedOrigins`, `periodicity`, `highlight`, `active` |
| `REGISTROS_AVALIACAO` | `id`, `coachId`, `studentId`, `variableId`, `value`, `unit`, `date`, `createdAt`, `actorId`, `origin`, `notes`, `supersedesId`, `kind`, `operationId`, `fingerprint` |

| Variável | Natureza | Unidade | Origem permitida | Periodicidade | Destaque |
| --- | --- | --- | --- | --- | --- |
| `height` · Estatura | Característica | cm | Mensuração direta | Inicial e conforme necessidade | |
| `mass` · Massa corporal | Característica | kg | Mensuração direta ou autorrelato | A cada 30 dias | Sim |
| `span` · Envergadura | Característica | cm | Mensuração direta | Inicial e conforme necessidade | |
| `ape` · Ape Index | Característica derivada | cm | Cálculo | Atualização das medidas de origem | |

A dimensão das quatro variáveis é física e biológica. O catálogo mantém dimensão, natureza, tipo e origem independentes. A estrutura comporta características, capacidades, estados e desempenhos, nas dimensões física e biológica, técnico-coordenativa, cognitiva e psicológica, ambiental e contextual e de desempenho esportivo. Cada modalidade poderá definir seu próprio protocolo e origem, incluindo observação, inferência ou hipótese, conforme o escopo de uma etapa futura.

Os IDs de treinador, aluno e responsável vêm de `Users`, e a autorização verifica `Links` e a sessão existente. `variableId` referencia o catálogo. `unit` é copiada do catálogo para preservar a unidade de cada fato. As medidas diretas aceitam decimais de 0,01 a 1.000 em suas unidades canônicas, com até três casas decimais. `date` é a data civil da avaliação em ISO, limitada à data atual no fuso da planilha. `createdAt` é o instante de registro em UTC.

`supersedesId` aponta para a medida substituída ou invalidada dentro do mesmo par treinador/aluno. `kind` distingue uma medida de um evento de invalidação. A correção de uma mensuração direta grava uma revisão com a nova data/valor e conserva a anterior. Um autorrelato incorreto pode ser invalidado pelo treinador em sua ficha e enviado novamente pelo aluno. O estado válido é derivado da cadeia de registros, com desempate entre medidas da mesma variável e data pela ordem de inclusão. A data de avaliação, a data de lançamento e o responsável ficam disponíveis no histórico.

O Ape Index é uma projeção de leitura. Para cada data com medida válida de estatura ou envergadura, o cálculo usa os últimos valores válidos até aquela data civil. O resultado referencia os dois IDs, datas e valores usados. O histórico mostra uma combinação por data. Correções posteriores recalculam a série válida, e o log de origem permite reproduzir a série como vista antes da correção usando o prefixo dos registros até aquele lançamento. A busca `assessmentAt_` recebe o conjunto válido de um par e uma data de corte, inclusive para reaproveitamento futuro da massa corporal.

O autorrelato grava uma cópia por treinador ativo no momento do envio, com o aluno como `actorId` e origem `self_report`. Um treinador recebe somente sua ficha de um vínculo ativo. Um novo vínculo recebe os autorrelatos enviados após sua ativação. Uma invalidação afeta somente o par autorizado. O aluno pode enviar sua massa pelo próprio login quando possui ao menos um vínculo ativo.

`operationId` e `fingerprint` são o recibo de gravação no próprio log. A operação é vinculada ao autor e aluno, usa uma chave UUID e compara o conteúdo normalizado nas tentativas seguintes. Um lote de medidas ou de cópias de autorrelato é enviado em um único `setValues`, sob o mesmo bloqueio de script das demais APIs, com `flush` antes de liberar. A interface bloqueia envios simultâneos e mantém a chave e o resumo criptográfico da tentativa pendente em `sessionStorage`. Ao recarregar a mesma aba, o operador pode repetir os mesmos campos; após a confirmação, uma nova intenção com os mesmos dados é aceita.

A ficha mostra a massa atual, a origem, o gráfico com valores válidos, a diferença em kg e em porcentagem sobre a medida válida anterior e a data da última medida acrescida de 30 dias. O aviso aparece a partir do 31º dia e usa o estilo neutro do cartão. A API da avaliação é independente das prescrições, cargas e da avaliação de desempenho da Biblioteca.

## Inicialização em cópia isolada

1. Prepare um projeto Apps Script de teste separado com o candidato, uma cópia privada da planilha de homologação e dados e contas de teste. Confira o ID na URL da cópia e o fuso da planilha. Registre o estado inicial das abas que já existem.
2. Em Script Properties do projeto isolado, configure `ENVIRONMENT=homologation` e aponte `SPREADSHEET_ID`, `HOMOLOGATION_SPREADSHEET_ID` e `ASSESSMENT_INIT_SPREADSHEET_ID` para o ID da mesma cópia. Confira separadamente se `LIBRARY_SPREADSHEET_ID`, quando configurado, também aponta para os dados isolados usados no teste da Biblioteca.
3. Pelo editor, execute `prepararAvaliacaoTeste_`. Em cópia sem as abas, confira `created` com os dois nomes, `seeded` com os quatro IDs, `catalogCount: 4` e `recordCount: 0`. O retorno pode ser conferido no depurador ou com registro temporário no projeto isolado.
4. Execute de novo e verifique `created: []`, `seeded: []` e os mesmos totais. Compare cabeçalhos, protocolos, unidades, registros e o estado das demais abas com a referência. Se surgir `SCHEMA_ERROR`, confronte os cabeçalhos e os contratos das variáveis com o código. Preserve as abas para análise.
5. Remova a autorização temporária `ASSESSMENT_INIT_SPREADSHEET_ID`. Registre a conferência e os resultados dos testes reais antes de preparar a homologação.

## Implantação futura em homologação

1. Registre a versão implantada, o deployment, os IDs das planilhas, a configuração de OAuth e o estado das abas. Faça cópia privada dos dados antes da mudança.
2. Confira se o código instalado é equivalente à v32 e se há diferenças locais. Se estiver sobre outra base, revise e reconcilie essas diferenças antes de sincronizar. A partir da v32, sincronize `Assessment.gs`, `Index.html` e `Student.html` do mesmo commit. Para reconstruir o HTML a partir das fontes, use `python3 student/build.py` e confira o diff.
3. Após aprovar o ensaio isolado, aplique a rotina de inicialização à planilha aprovada de homologação com as três propriedades coincidentes. Confira o resultado e remova a autorização temporária.
4. Teste a revisão no ambiente de homologação com as contas permitidas. Depois da aprovação, atualize a implantação existente com uma nova versão para manter a URL e o redirecionamento de OAuth. Confirme o login de treinador e aluno, o cartão Avaliação, o autorrelato e a gravação de uma sessão de treino.

## Reversão

1. Aponte o deployment de homologação novamente à versão registrada antes da mudança. Se for necessário restaurar as fontes do editor, recupere `Index.html` e `Student.html` daquela revisão e remova `Assessment.gs` do conjunto ativo do projeto.
2. Mantenha as duas abas para eventual retomada e auditoria. Confirme a revogação de `ASSESSMENT_INIT_SPREADSHEET_ID` e a configuração de planilhas e OAuth.
3. Confirme o acesso de treinador e aluno e compare cadastro, treinos e feedback com o estado registrado antes da implantação. Verifique que os registros antropométricos continuam na planilha para recuperação futura.

## Autoauditoria

### Executado localmente

- `node --test tests/*.test.cjs`. 230 testes aprovados. Cobrem o backend, scripts de autenticação, inicializadores, fluxos e modelos. AVA-01A cobre integridade do catálogo, inicialização idempotente e destino incorreto, falha de gravação simulada, limites e unidades, datas, medidas parciais e retroativas, Ape Index com referências, intervalo mensal, ausência de dados, correção, invalidação, tentativa concorrente, reenvio e isolamento de acesso. Os testes dos catálogos confirmam os 183 exercícios de musculação, os 65 preventivos e os 84 vínculos bibliográficos.
- `python3 tests/assessment-browser.py`. Chromium com Sheets e OAuth simulados. Exercita perda de confirmação após escrita e reenvio após recarga nas duas interfaces, gráfico, correção, invalidação e troca de aluno. Também compara as demais tabelas antes e depois.
- Os 13 scripts `tests/*-browser.py` passaram em Chromium. A regressão abrange layout, montagem, Fingerboard e Campus Board, catálogo geral, retorno do login, feedback, ciclo da prescrição, preventivos, modelos, treinamento específico, musculação e financeiro.
- `python3 -m unittest discover -s tests -p 'test_*.py'`. Os nove testes do comparador de arquivos do Apps Script passaram.
- `git diff --check` e reconstrução de `Student.html` com `python3 student/build.py`.

### Conferido por inspeção

O diff preserva o manifesto e os escopos OAuth, a implementação de autenticação, os catálogos, o backend financeiro e os contratos dos treinos, sessões, modelos JSON v1/v2/v3 e feedback. A verificação de funções públicas inclui a nova `assessmentApi` e confirma que `prepararAvaliacaoTeste_` permanece privada. A auditoria local usou somente dados fictícios.

### Pendências e limites

- Confirmar no Apps Script real o login com as contas da homologação, o acesso privado à cópia, as propriedades e o fuso, a formatação de datas na localização da planilha e a repetição após perda de confirmação. Testar também revogação de vínculo, papéis, abas separadas, gravação concorrente e o fluxo em Safari móvel.
- O histórico usa leituras das abas e bloqueio por projeto. O dimensionamento foi validado para a fase de homologação. O bloqueio coordena chamadas do mesmo projeto, enquanto edições manuais ou em projetos paralelos exigem controle operacional da planilha.
- Reenvio após recarga depende de `sessionStorage` disponível na mesma aba e dos mesmos campos. Se o navegador bloquear o armazenamento, a chave fica disponível em memória enquanto a página permanecer aberta. A interface orienta a manter a aba aberta quando detecta essa restrição.
- A massa é armazenada e exibida para avaliação longitudinal. As sessões e os indicadores de carga históricos seguem as referências com que foram gravados.

**Parecer** — candidato apto ao ensaio em cópia isolada e à verificação independente. A aprovação da implantação de homologação depende das verificações reais acima. Esta entrega foi desenvolvida e testada localmente, sem inicialização de planilha real ou publicação do Apps Script.
