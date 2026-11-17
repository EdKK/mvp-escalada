# Instalação de desenvolvimento e validação

## Resultado local e evidências

Comando: `node --test tests/*.test.cjs`. Ambiente Node apenas para a suíte já existente, sem dependências novas. Foram executados 61 testes: os 45 anteriores e 16 do novo módulo, todos aprovados. Os serviços Apps Script/Sheets são objetos simulados em memória. Não houve chamadas a uma planilha real, teste de autenticação Google real ou implantação nesta etapa.

| Verificação exigida | Evidência em tests/library.test.cjs |
| --- | --- |
| Cadastro/recuperação e IDs únicos | Cadastro, getExercise, listExercises, UUIDs e replay de requestId. |
| Duplicidade de exercício | Normalização de nome e reserva após falha; outro requestId é rejeitado. |
| Diferentes métodos para um exercício | Associações N:N e repetição idempotente, sem duplicação do exercício. |
| Indicadores/unidades | Catálogo com FKs válidas; principal obrigatório e auxiliares separados. |
| Isometria | Repeaters: 4×6×7=168 s; max hangs: 5×1×10=50 s. |
| Repetições | Supino: 5×3=15 rep; execução futura heterogênea 5+3+0=8 rep. |
| Movimentos de mão | Boulder 4×4×5=80 movimentos; total executado fictício 7+4+2=13. Sem campos separados de reboteio. |
| Indicador/unidade incompatíveis | %FCmáx no principal de supino, unidades trocadas, percentual sobre grau e escala ausente rejeitados. |
| Referências ausentes/expiradas | Avaliação inexistente, outro aluno, validade anterior à sessão, unidade inválida e avaliação substituída rejeitadas. |
| Referência histórica | Snapshot de 100 kg preservado após nova avaliação de 110 kg; prescrição anterior e linhas de Items/Workouts intactas. |
| Preservação/idempotência | Inicializar duas vezes mantém exatamente todos os registros legados e não duplica catálogo. Cabeçalho incompatível bloqueia antes de escrita. Falha parcial de esquema/catálogo/filhos pode ser retomada. |
| Isolamento/autorização | Aluno B não acessa avaliação/prescrição A; alunos não administram; sessão ausente recusada; dois treinadores ativos bloqueiam administração nova. |
| Compatibilidade | A suíte anterior continua passando sem modificar seus módulos. |

Os quatro exemplos completos são [fixtures JSON](../../tests/fixtures/library-examples.json). Não são recomendações, não criam treinos automaticamente e não correspondem a alunos reais.

## Preparar ambiente Google separado (manual, ainda não executado)

1. Criar planilha **nova e exclusiva de desenvolvimento**, privada ao proprietário. Não usar planilha de produção nem IDs já usados em produção. Seguir as instruções existentes de homologação se for necessário autenticar os três Gmail controlados; não alterar OAuth para esta etapa.
2. Em um projeto Apps Script de desenvolvimento/homologação, manter os módulos existentes e adicionar TrainingLibrary.gs, TrainingLoad.gs e TrainingCatalog.gs. Não substituir Backend.gs ou alterar manifestos/escopos.
3. Definir Script Properties: ENVIRONMENT=homologation, SPREADSHEET_ID=ID da nova planilha, HOMOLOGATION_SPREADSHEET_ID=mesmo ID (somente se usar a carga fictícia existente) e **LIBRARY_SPREADSHEET_ID=mesmo ID**. A terceira confirmação não identifica outra planilha: serve para impedir que o novo módulo escreva onde não foi explicitamente autorizado. Não versionar valores reais.
4. Se a planilha estiver vazia, executar initializeSchema_ para a base legada e seedHomologation_ para treinador/dois alunos/treinos/itens fictícios. Essas rotinas existentes têm suas próprias condições; nunca tentar repetir carga antiga apagando linhas. Se a base de desenvolvimento já existir, apenas verificar os cabeçalhos e a existência de Users/Links/Workouts/Items/Requests, sem recriar dados.
5. Executar initializeLibraryDevelopment_ pelo editor. É privada para RPC e não precisa fingir ser um aluno. A rotina cria somente as 10 novas abas do módulo e o catálogo de definições: 10 exercícios, capacidades/manifestações, métodos/protocolos, indicadores/unidades e associações. Não cadastra avaliações, sessões, prescrições ou execuções. Repeti-la deve produzir exatamente o mesmo catálogo e preservar registros existentes.
6. Se houver cabeçalho incompatível, duplicidade ou falha, parar e inspecionar. Não renomear, limpar ou sobrescrever abas para contornar. Uma aba completamente vazia resultante de insertSheet sem cabeçalho pode receber o cabeçalho na repetição; uma aba com qualquer registro/cabeçalho incompatível é preservada e causa erro.
7. Atualizar **somente a implantação de desenvolvimento/homologação**, se for testar RPC. Manter URL e configurações OAuth conforme os procedimentos existentes. Não atualizar produção ou demonstração hospedada. O repositório por si só não disponibiliza as novas funções no Google.

## Chamadas de teste (somente com dados fictícios)

No console do navegador, dentro do frame HtmlService da aplicação de desenvolvimento, usar uma sessão Google própria de teste. Para obter uma sessão técnica sem acessar variáveis privadas da interface:

```js
function homRpc(method, request) {
  return new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(r => r.ok ? resolve(r.data) : reject(Error(r.error.code)))
      .withFailureHandler(() => reject(Error('TRANSPORT_ERROR')))[method](request);
  });
}
const login = await homRpc('api', {action:'beginLogin', data:{}});
console.log(login.authorizationUrl); // Abrir este URL em outra aba e concluir Google.
// Voltar à aba original, sem recarregar:
const auth = await homRpc('api', {action:'finishLogin', data:{transaction:login.transaction, proof:login.proof}});
const lib = (action,data={},requestId) => homRpc('libraryApi', {action,data,requestId,sessionToken:auth.sessionToken});
await lib('listExercises');
await lib('getExercise',{exerciseId:'exercise-finger-iso'});
```

Não imprimir login, auth, proof ou sessionToken. As credenciais configuradas continuam apenas no Google. A conta deve estar em Users, ativa, com papel correto; apenas um treinador ativo administra o módulo.

Para a cadeia completa, criar uma sessão/item fictícios pela api legada (ou usar IDs dos exemplos antigos em hom-workout-a/hom-item-a), registrar a avaliação e validar/gravar a prescrição. Exemplo com os IDs antigos de homologação:

```js
const a = await lib('recordAssessment', {
  studentId:'hom-student-a', exerciseId:'exercise-finger-iso', indicatorId:'int-max-force',
  value:400, unitId:'unit-newton', protocol:'Teste fictício em borda de 20 mm',
  referenceDefinition:'Força de referência fictícia em N; apoio e critério documentados para o teste.',
  assessedOn:'2026-11-01', validUntil:'2026-12-31'
}, 'dev-assessment-repeaters-01');
const plan = {
  workoutId:'hom-workout-a', itemId:'hom-item-a', exerciseId:'exercise-finger-iso',
  methodId:'method-isometric', protocolId:'protocol-repeaters', classification:'specific',
  intensity:{indicatorId:'int-max-force',assessmentId:a.id,percent:60},
  volume:{kind:'isometric',unitId:'unit-hang-seconds',sets:Array.from({length:4},()=>({suspensions:6,seconds:7}))},
  expectedRevision:0
};
await lib('validateLoad',plan);
const prescription = await lib('createLibraryPrescription',plan,'dev-prescription-repeaters-01');
await lib('getLibraryPrescription',{prescriptionId:prescription.id});
```

**Data do exemplo:** hom-workout-a da carga antiga tem data 2026-11-16; os exemplos são fictícios e as datas acima precisam ser coerentes com a sessão selecionada. Não mudar a avaliação real para contornar validade. Para uma sessão/item já com prescrição nova, expectedRevision deve ser a revisão existente; para começar do zero, criar outro item fictício sem apagar o anterior.

Repetir a mesma chave deve devolver o mesmo ID. Outra chave com nome de exercício normalizado já existente ou revisão antiga deve retornar CONFLICT. Nova avaliação usa supersedesId e não sobrescreve a anterior. A prescrição histórica permanece consultável mesmo depois de a avaliação expirar/substituir-se. A chave é uma intenção: não gerar outra chave automaticamente após falha de rede.

## Contratos novos

Todas as operações usam libraryApi({action,data,requestId?,sessionToken}); o envelope de resposta é igual ao legado. requestId é obrigatório nas escritas. Cadastro/associações/avaliações/prescrição são somente do treinador único ativo. getAssessment/getLibraryPrescription permitem aluno proprietário ou treinador autorizado. Catálogo não é exposto a alunos pela API nova nesta etapa.

| action | data |
| --- | --- |
| catalog / listExercises | {} |
| getExercise | {exerciseId} |
| createExercise | {name,description,modality,primaryIndicatorId,primaryVolumeUnitId,volumeUnitIds,status?} |
| linkExerciseMethod | {exerciseId,methodId} |
| linkExerciseCapacity | {exerciseId,capacityId} |
| recordAssessment | {studentId,exerciseId,indicatorId,value,unitId,protocol,referenceDefinition,assessedOn,validUntil,supersedesId?} |
| getAssessment | {assessmentId} |
| validateLoad / createLibraryPrescription | {workoutId,itemId,exerciseId,methodId,protocolId?,capacityId?,classification,intensity,auxiliaryIntensities?,volume,expectedRevision} |
| getLibraryPrescription | {prescriptionId} |

Status retornados incluem INVALID_DATA, INCOMPATIBLE_INDICATOR, INCOMPATIBLE_UNIT, ASSESSMENT_NOT_FOUND, ASSESSMENT_OUTDATED, NOT_FOUND, FORBIDDEN, CONFIGURATION_ERROR, CONFLICT, BUSY e INTERNAL_ERROR. Tokens/erros Google internos não são expostos. validateLoad não escreve; a criação exige expectedRevision. Nenhuma API exclui ou atualiza avaliações/prescrições anteriores.

## Homologação Google pendente

Validar criação repetida de estrutura, ausência de alterações nas abas antigas, tipos/datas reais devolvidos pelo Sheets, limites de células e leitura dos JSONs, permissões dos três Gmail, operação simultânea e retomada após falha real. Conferir que o aluno B recebe NOT_FOUND para IDs de A e que nenhuma requisição do aluno administra o catálogo. Registrar os quatro resultados 168/50/80/15 com unidades e referências distintas. Conferir alteração de referência por supersessão e snapshot histórico.

A etapa não valida fisiologicamente protocolos nem promove o módulo à produção. Ainda faltam decisões de campus board, referências específicas e ponte de integração descritas em ARQUITETURA.md. Não existe novo painel visual; não executar builds ou publicação Sites para esta entrega.
