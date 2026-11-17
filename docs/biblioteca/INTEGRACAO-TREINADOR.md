# Etapa 2 — Biblioteca na interface do treinador

Branch: `feature/biblioteca-exercicios`. Sem implantação automática, migração ou inicialização. OAuth, Backend.gs, Student.gs/StudentLogic.gs, Student.html, OAuthReturn.html e appsscript.json foram preservados.

## Implementação

O formulário existente mantém aluno, data, objetivo, orientações, bloco, categoria, quantidade, métrica, intensidade, minutos, observações e consulta de sessões. A digitação do exercício foi substituída pela seleção de exercícios ativos da biblioteca. A descrição, capacidades/manifestações, métodos e protocolos são recuperados pelos IDs existentes. O catálogo inicial contém dez exercícios; registros inativos não são oferecidos nem aceitos numa nova prescrição.

A intensidade usa o indicador principal: percentual com avaliação individual válida, grau com escala preservada, ou descrição qualitativa para campus board, sem fórmula numérica. Avaliações são filtradas por aluno, exercício, indicador, unidade e data da sessão. Não há cadastro de avaliações nesta interface: utilizar o fluxo `recordAssessment` da Etapa 1 quando necessário, exclusivamente com dados fictícios.

O volume depende da unidade: repetições por série; suspensões e segundos por série; blocos, trechos e movimentos de mão; tempo ou distância. Há distribuição opcional por linha para séries diferentes. A métrica acompanha a unidade estruturada. Os campos legados de quantidade e minutos continuam armazenados em Items; o volume calculado e a referência individual ficam em PRESCRICOES e PRESCRICAO_SERIES, não em texto livre.

## Integração e integridade

`api()` continua responsável pelas sessões e pelos fluxos antigos. `libraryApi()` recebe o mesmo token opaco via `google.script.run`, preservando a autenticação atual. Novas ações, exclusivas do treinador autorizado:

- `listAssessments`: referências utilizáveis na sessão selecionada.
- `listLibraryPrescriptions`: consulta das prescrições da sessão autorizada.
- `saveCoachPrescription`: valida o item e a prescrição antes de gravar; coordena Items, PRESCRICOES e PRESCRICAO_SERIES.
- `listPendingCoachSaves` e `coachSaveStatus`: recuperação e diagnóstico de intenções próprias, com permissões revalidadas.

Não há tabelas nem colunas novas. Workouts continua sendo a sessão. O servidor determina o nome do exercício e o ID do item. A autorização é conferida no servidor, inclusive no replay; alunos não podem executar as novas ações. O mesmo ScriptLock da biblioteca serializa a operação. IDs de requisição, reservas em Requests e snapshots da Etapa 1 evitam duplicação e permitem completar gravações parciais sem alterar prescrições históricas.

Google Sheets não oferece transação entre abas. Durante uma falha, pode existir um item sem sua prescrição completa. A intenção permanece recuperável: usar “Retomar gravação pendente”, inclusive após novo login. Não criar outra intenção para contornar o erro. O formulário bloqueia alterações durante uma intenção não confirmada. “Corrigir parâmetros” só libera nova tentativa se o servidor confirmar que nenhuma reserva começou. Se a avaliação perder validade antes de completar a prescrição, a validação bloqueia a recuperação: registrar os IDs técnicos e investigar; não apagar linhas nem substituir a avaliação histórica automaticamente.

## Atualizar exclusivamente a homologação

1. No computador, confirmar o projeto **MVP Escalada - Homologação** e guardar uma cópia privada do código atual. Confirmar a planilha de teste independente, com dados exclusivamente fictícios; não inferir isolamento pelo nome do projeto.
2. Conferir, sem copiar valores para logs ou GitHub: `ENVIRONMENT=homologation`, `LIBRARY_SPREADSHEET_ID` e `SPREADSHEET_ID` apontando para a mesma planilha de teste já inicializada. Preservar as propriedades OAuth e os vínculos fictícios do treinador com os alunos. Nenhuma propriedade nova é exigida.
3. Adicionar **CoachLibrary.gs**. Atualizar **Index.html**, **TrainingLibrary.gs** e **TrainingLoad.gs** com os arquivos desta branch. Manter TrainingCatalog.gs e os demais arquivos existentes. Se o projeto usa StudentLogic.gs, manter esse nome; não adicionar também Student.gs.
4. Salvar e abrir a implantação de teste/de desenvolvimento existente, autenticando como treinador fictício autorizado. Para uma implantação versionada de homologação, o proprietário deve criar uma versão e selecionar essa versão somente naquela implantação. Não criar nem atualizar implantação de produção. Não executar inicialização, migração ou rotinas de limpeza.
5. No iPhone, abrir o endereço da homologação após a atualização e recarregar. O editor e a atualização dos arquivos são mais adequados ao computador. O login continua usando o fluxo OAuth existente.

Os arquivos estáticos de demonstração permanecem na Etapa 1. `demo/coach-etapa1-source.html` preserva a fonte anterior do gerador para que ele não anuncie uma integração que seu backend simulado ainda não implementa. Nenhuma demonstração foi publicada nesta etapa.

## Validação simples com dados fictícios

1. Entrar como treinador; conferir dez exercícios ativos no seletor (mais a opção inicial). Criar ou selecionar sessão de um aluno fictício. Conferir aluno, objetivo, orientações e data.
2. Selecionar **Supino** e um método associado. Selecionar uma avaliação fictícia de 1RM de **100 kg**, válida para esse aluno/exercício e para a data da sessão. Informar **85%**, **5 séries**, **3 repetições**, bloco, categoria e minutos. Salvar uma vez.
3. Conferir confirmação e consulta: alvo **85 kg**, volume **15 repetições**. Em Sheets, verificar uma sessão em Workouts, um novo item em Items, uma prescrição em PRESCRICOES e cinco linhas em PRESCRICAO_SERIES. O `itemId`, `workoutId`, `studentId` e `assessmentId` devem corresponder; a avaliação deve continuar intacta.
4. Selecionar fingerboard isométrico: a interface deve pedir suspensões e segundos. Exemplo: 4 séries × 6 suspensões × 7 segundos = **168 segundos de suspensão**, com referência individual válida para a intensidade escolhida.
5. Selecionar boulder: grau **V4**, escala **V**, 4 blocos × 4 trechos × 5 movimentos = **80 movimentos de mão**, sem conversão para percentual. Campus board deve mostrar somente referência qualitativa, sem intensidade numérica calculada.
6. Reabrir a sessão e conferir os resumos estruturados. Conferir que sessões e itens antigos continuam consultáveis. Não repetir testes de falha deliberadamente sobre dados reais. Para ensaio de conexão interrompida, usar apenas teste fictício, retomar a mesma intenção e conferir ausência de duplicações.
7. Como aluno, confirmar que os fluxos anteriores continuam acessíveis e que não aparece formulário de prescrição. Tentativas de executar as novas ações com token de aluno devem ser rejeitadas no servidor. Registrar resultado sanitizado, IDs fictícios e contagens; não registrar tokens, e-mails reais ou propriedades.

## Testes e limites

`node --test tests/*.test.cjs`: **82 aprovados, zero reprovados** — os 67 anteriores e 15 novos testes. Os novos testes cobrem catálogo ativo, vínculos compatíveis, seleção assíncrona, unidades, referências individuais, gravação coordenada, autorização, conflito de requisição, lock ocupado, recuperação de falhas em cada etapa, replay após substituição de avaliação e preservação de itens antigos. Três testes exercitam os handlers da interface com DOM e google.script.run simulados, inclusive perda de resposta e retomada após recarregar.

`python -m unittest discover -s tests -p 'test_*.py'`: **8 aprovados, zero reprovados**. A suíte Python do comparador verifica somente cópias locais e hashes. O manifesto de sincronização inclui CoachLibrary.gs e fixa os bytes da implementação no commit bae615f; o roteiro SINCRONIZACAO-CONTROLADA.md permanece como registro histórico da Etapa 1. Nenhum desses testes comprova execução real de Apps Script, Sheets, OAuth, navegadores móveis ou concorrência distribuída. A validação operacional acima deve ser registrada pelo proprietário na homologação. Não foi feita implantação nem acessada planilha Google nesta etapa.

A interface do aluno não foi alterada e ainda não apresenta os novos detalhes de PRESCRICOES por série. Não foram implementados edição/revisão de prescrições pela interface, cadastro de avaliações, dashboards, periodização, carga global ou migração de itens antigos. A liberação operacional continua condicionada à homologação real de segurança, persistência e concorrência.
