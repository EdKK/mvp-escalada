# Homologação real — instalação manual reproduzível

## Referência de homologação informada

O treinador informou a v19 como referência em **MVP Escalada – Homologação**. A Etapa 02 parte do commit `5e13ba78b6256a51531be8d7f3e0b1081b16e323` da branch `codex/simplificar-prescricao`, verificado no GitHub. Nesta etapa, a validação do Fingerboard usa serviços locais simulados. A correspondência entre o commit e o código instalado no Google ainda requer verificação direta.

### Histórico da v18

O registro anterior vinculava a v18 ao commit `17278cb55c2aac1dabdff0580326d25fbf32498d`.

A avaliação manual da v18 confirmou a criação de sessão pelo treinador, a visualização pelo aluno da sessão de 28/11/2026, a apresentação dos cinco subblocos e a apresentação de orientação, inclinação, grau, séries, repetições e intervalos de recuperação. O treinador aprovou visualmente os campos da prescrição, com os ajustes descritos no [novo candidato](TREINAMENTO-ESPECIFICO.md). Houve um aviso de carregamento da biblioteca com `BUSY`. A homologação funcional completa permanece pendente.

### Histórico da v17

A v17 teve como referência `f9fc2089f0caba1c9cb10dd9db0a4df5081db4de`. Os testes manuais aprovados informados abrangiam salvamento de exercícios pelo treinador, visualização e conferência da interface do aluno, envio de feedback pelo aluno e retorno ao treinador. A v16 era a referência de reversão registrada naquela etapa.

As regras dos cinco subblocos, integridade dos dados, segurança e isolamento, concorrência, recuperação de gravações interrompidas e demais testes de integração exigem evidência própria no ambiente real. As execuções automatizadas locais usam serviços simulados.

## Instalação atual — três Gmail pessoais

A instalação e autenticação foram atualizadas para OAuth explícito. Seguir [AUTENTICACAO-GMAIL.md](AUTENTICACAO-GMAIL.md) para criar cliente OAuth externo em Testing, adicionar as três contas Gmail controladas e configurar redirect /exec e credenciais somente no Google. Não é necessário Workspace e não se usa Session.getActiveUser. Não aplicar as orientações anteriores de acesso restrito ao domínio.

Resumo reproduzível:

1. Criar planilha nova, vazia, privada e exclusiva de homologação e projeto Apps Script independente. Não compartilhar com alunos ou treinador de teste; somente o proprietário administra o armazenamento.
2. Copiar Backend.gs, Student.gs, Auth.gs, Homologation.gs, Index.html (nome HTML Index), Student.html (nome HTML Student), OAuthReturn.html (nome HTML OAuthReturn) e appsscript.json. Não copiar arquivos legados da raiz. Configurar ENVIRONMENT=homologation, SPREADSHEET_ID e HOMOLOGATION_SPREADSHEET_ID com o ID da mesma planilha vazia. ID é o trecho entre /d/ e /edit do URL do Sheets.
3. Configurar cliente OAuth/consentimento e implantação de teste executada como proprietário, conforme o documento de autenticação. Alunos consentem somente openid/email. Proprietário autoriza spreadsheets e script.external_request. Manter todos os valores reais fora do Git. Acesso externo ao shell é necessário; acesso aos dados continua condicionado a OAuth e Users ativo.
4. Executar seedHomologation_ no editor apenas na planilha vazia; autorizar como proprietário. A rotina recusa tabelas com registros, inclusive carga anterior/parcial. Nunca limpar planilha para repetir: inspecionar ou selecionar outra planilha vazia. Na aba Users substituir somente emails example.invalid pelos três Gmail de teste, mantendo IDs/papéis/booleanos.
5. Abrir o /exec da implantação de teste como aluno; treinador usa /exec?view=coach. Preparar entrada, abrir Google na nova aba, escolher conta e voltar à aba original para Concluir entrada. Não usar /dev para comprovar acesso de aluno. A planilha e o código devem permanecer inacessíveis aos alunos.
6. No computador e no Safari do iPhone repetir com cada conta controlada. Login/estado duram 10 minutos; sessão MVP dura no máximo 30 minutos. Fechar/recarregar a aba exige novo login. Sair revoga somente a sessão MVP. Não publicar para usuários reais.

## Protocolo de aprovação (registrar resultado, data, papel e evidência sem emails)

Os casos completos abaixo aguardam evidência individual no Google. O histórico acima registra os fluxos manuais aprovados. Use este protocolo para comprovar as condições adicionais de cada caso e registrar as verificações da próxima versão.

| Caso | Ação | Resultado obrigatório |
| --- | --- | --- |
| H01 identidade | Fazer login OAuth com treinador e cada aluno | IDs/papéis distintos hom-coach, hom-student-a, hom-student-b; nenhuma identidade herdada do proprietário |
| H02 planilha privada | Abrir URL da planilha como cada aluno | Acesso negado, sem solicitar/conceder compartilhamento; aplicação continua funcionando |
| H03 listagem | Treinador consulta; aluno A e B consultam | Treinador vê dois treinos; cada aluno somente o seu e respectivo item |
| H04 treino | Treinador cria treino A e adiciona item | UUID do servidor; registro em Workouts/Items; aluno A vê e B não |
| H05 persistência | Fechar e reabrir /exec em outra sessão da mesma conta | Treino e item continuam disponíveis |
| H06 retorno | A envia Parcial/Dor, dor 3, RPE 6, comentário fictício | Uma linha Feedback com studentId A; treinador consulta; B não vê |
| H07 validação | Enviar Parcial sem motivo; dor 11; RPE 0; data impossível via RPC | INVALID_DATA; nenhuma entidade escrita |
| H08 acesso indevido | Como A, getWorkout/listFeedback/submitFeedback para hom-workout-b | NOT_FOUND; nenhum dado B exposto |
| H09 papéis | Como aluno tentar createWorkout/addItem; como treinador submitFeedback | FORBIDDEN; nenhuma entidade escrita |
| H10 repetição | Enviar duas vezes o mesmo payload com o mesmo requestId | Mesmo UUID; uma linha de entidade; payload diferente com a mesma chave → CONFLICT |
| H11 concorrência | Duas sessões simultâneas enviam mesma chave/payload; depois chaves diferentes | Um registro por chave; BUSY admite repetição; nenhum item órfão |
| H12 usuário ausente | Gmail de teste fora de Users; depois RPC sem sessão MVP | Login recusado para não cadastrado; UNAUTHENTICATED na API sem sessão, mesmo que Google esteja conectado |
| H13 vínculo | Proprietário marca vínculo A inativo e treinador tenta consultar/criar | Treinador perde acesso ao treino A e criação para A; restaurar apenas o booleano de teste |
| H14 iPhone | Executar H03–H06 pelo Safari com aluno A | Formulários utilizáveis, persistência e histórico iguais ao computador |

Para H07–H11 usar o console no computador, selecionando o frame HtmlService (google.script.run e createRpc devem estar definidos). Não executar API no editor como se fosse aluno. Para uma sessão técnica independente, iniciar OAuth dentro do próprio console, sem imprimir provas ou tokens:

```js
const homRaw = createRpc(google.script.run);
const homAttempt = await homRaw({action:'beginLogin',data:{}});
console.log(homAttempt.authorizationUrl); // Abrir SOMENTE este URL em nova aba e concluir Google.
// Voltar ao console original, sem recarregar, após mensagem de conclusão no callback:
const homResult = await homRaw({action:'finishLogin',data:{transaction:homAttempt.transaction,proof:homAttempt.proof}});
const homApi = createRpc(google.script.run, () => homResult.sessionToken);
// Como aluno A:
await homApi({action:'getWorkout', data:{workoutId:'hom-workout-b'}});
// Esperado: rejeição NOT_FOUND.
```

Não executar console.log(homAttempt), console.log(homResult) ou imprimir tokens. Não compartilhar estado do console. Para H10/H11:

```js
const req = {action:'submitFeedback', requestId:'hom-feedback-repeat-01',
  data:{workoutId:'hom-workout-a',status:'Concluído',reason:'',fingerPain:0,rpe:5,comment:'Teste fictício de repetição'}};
const results = await Promise.allSettled([homApi(req),homApi(req)]);
console.log(results); // Somente resultado das entidades, sem tokens.
await homApi({action:'logout',data:{}});
```

Repetir também nas sessões reais de dois navegadores; o exemplo de chamadas sobrepostas não garante por si só disputa efetiva de lock no Google.

Conferir linhas e IDs como proprietário. Não registrar emails, cookies, tokens ou conteúdo de contas reais em evidências. Nunca considerar H11 aprovado somente porque o teste local de lock passou. A perda das chaves em memória ao recarregar a interface é uma limitação conhecida: para H10 usar a chave explícita acima.

## Impedimentos e encerramento

Dependem de ação manual: criação de contas/projeto/planilha, cliente OAuth externo em Testing, consentimento, cadastro de test users, redirect autorizado, implantação de teste e observação das identidades reais. Os resultados manuais informados para a v17 constam em Estado publicado. Se H01 ou H02 falhar, não prosseguir para usuários reais; documentar a modalidade de implantação e revisar autenticação. Após os testes, arquivar a implantação de homologação quando não for mais necessária; preservar evidências sem dados pessoais. Esta etapa não autoriza migração, implantação em produção ou merge.


Para a nova interface do aluno e os testes de relógios, revisões de feedback e unidades, seguir também INTERFACE-ALUNO.md. As verificações de domínio Workspace foram substituídas pelo OAuth explícito para Gmail.


Retorno OAuth mobile: copiar OAuthReturn.html junto com Backend.gs. O card usa fontes maiores e tenta fechar apenas a aba do callback, automaticamente após 4 segundos no sucesso ou pelo botão. Safari/HtmlService podem bloquear o fechamento; usar o seletor de abas e retornar à aba original, sem recarregá-la. O link de recuperação inicia outra entrada somente se a aba original foi perdida; ele não transporta a prova OAuth. Validar esses comportamentos no Safari real.
