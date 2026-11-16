# Base segura — etapa 1

Implementação independente: os cinco arquivos originais permanecem intactos. Não há implantação, interface nova, migração ou acesso a dados reais nesta etapa.

## Contrato e esquema

`api(request)` é o único ponto de entrada remoto, destinado a `google.script.run` em uma futura interface HtmlService. Não há endpoint HTTP `doGet`/`doPost` nesta etapa. Funções com sufixo `_` são privadas para RPC do Apps Script.

Operações:

- `listWorkouts`, `data: {}`: treinos visíveis.
- `getWorkout`, `data: {workoutId}`: treino e itens; inexistência e falta de acesso produzem o mesmo NOT_FOUND.
- `createWorkout`, `requestId`, `data: {studentId, date, goal}`.
- `addItem`, `requestId`, `data: {workoutId, block, category, exercise, metric, quantity, minutes, notes?}`.

Resposta: `{ok:true,data:...}` ou `{ok:false,error:{code:...}}`. O cliente deve renderizar texto com textContent e tratar BUSY com espera e repetição limitada, mantendo requestId. Cada intenção nova recebe outra chave. Campos desconhecidos são rejeitados. Datas usam YYYY-MM-DD; quantidade e minutos aceitam números entre 0 e 100000. Textos não podem começar com indicadores de fórmula, inclusive após espaços.

Cabeçalhos exatos estão em SCHEMA_ no Backend.gs:

| Aba | Identidade e relacionamentos |
| --- | --- |
| Users | id único; email único por usuário ativo; role coach/student; active booleano |
| Links | id único; coachId e studentId referenciam Users; active booleano |
| Workouts | id UUID; coachId e studentId referenciam Users |
| Items | id UUID; workoutId referencia Workouts |
| Requests | id UUID; par userId/key único; entity/entityId identificam a gravação reservada |

Users e Links são provisionados exclusivamente pelo administrador na planilha. IDs nunca são nomes exibidos. Não existe cadastro remoto de permissões. A API gera IDs e timestamps; ignora-se qualquer alegação de identidade do cliente por rejeição de campos extras. Treinadores acessam apenas treinos próprios com vínculo ativo; alunos leem apenas seus treinos e não escrevem. A planilha não deve ser compartilhada com alunos.

## Autenticação e homologação Google

1. Criar projeto Apps Script independente e uma **planilha vazia exclusiva de homologação**. Copiar Backend.gs e appsscript.json para o editor. Não instalar dependências do package.json original (inválido e não utilizado).
2. Em configurações do projeto, adicionar a propriedade de script SPREADSHEET_ID. Esse ID é configuração, não segredo de autenticação. Não versionar configurações reais.
3. Executar initializeSchema_ manualmente no editor como administrador. A função cria somente abas ausentes; cabeçalhos incompatíveis causam erro sem limpeza. Provisionar usuários e vínculos de teste. Configurar as colunas de data como texto simples para manter YYYY-MM-DD no retorno. Não editar tabelas durante testes de escrita.
4. Validar a identidade **na modalidade de execução escolhida**, com contas de teste distintas. Session.getActiveUser().getEmail() precisa fornecer o usuário chamador. Email vazio é UNAUTHENTICATED: não usar getEffectiveUser como fallback, nem aceitar email/token fornecido pelo navegador.
5. Para futura interface, uma implantação restrita ao domínio Workspace, executada pelo proprietário, pode permitir identidade ativa e planilha privada, mas isso depende das políticas do domínio e precisa ser comprovado. Não pressupor suporte a contas pessoais externas. Se a identidade não estiver disponível, a implantação está bloqueada até definir outro provedor verificado. Executar como usuário pode exigir acesso direto à planilha e não preserva isolamento se ela for compartilhada; não usar essa configuração para alunos.
6. Nenhum aplicativo é publicado nesta entrega. Chamadas pelo editor comprovam apenas a identidade do operador. Homologação RPC exigirá uma interface de teste controlada e implantação posteriormente autorizada.

## Concorrência, repetição e recuperação

Todas as operações usam ScriptLock (inclusive consultas) para obter uma visão consistente entre chamadas deste projeto. A escrita reserva ID e fingerprint em Requests e faz flush antes de gravar a entidade. Nova tentativa com a mesma chave e conteúdo retorna o registro existente ou completa a gravação pendente. Conteúdo diferente retorna CONFLICT. Autorizações são reavaliadas antes de uma repetição. Requests não deve ser limpo sem política de retenção: remover chaves elimina proteção contra duplicidade.

Sheets não tem transações ACID. Falhas podem deixar reservas pendentes, recuperáveis pela mesma requisição. Chaves diferentes podem criar treinos semelhantes: deduplicação é por intenção (requestId), não por aluno/data. Bloqueios não coordenam edição manual ou outros projetos Apps Script. Não compartilhar a escrita com outro projeto. Não há exclusão, atualização, auditoria completa, paginação ou rollback automático nesta etapa. Leituras completas e bloqueio global limitam escala; medir quotas e volume antes de produção. Requests guarda conteúdo normalizado para comparação: restringir acesso e definir retenção antes de dados reais.

## Testes e critérios de homologação

Executar da raiz: `node --test tests/backend.test.cjs` (Node 18+). Sem dependências npm. Os serviços Google são substituídos por objetos locais: os testes NÃO comprovam execução real, identidade Google, quotas, persistência ou concorrência distribuída.

Cobertura local: identidade ausente/usuário inativo, isolamento entre alunos, permissão de treinador/vínculo, escrita por aluno, dados inválidos/fórmulas, idempotência de treino e item, conflito de chave, recuperação após falha parcial, contenção de lock e proteção de esquema.

Homologação pendente, em planilha de teste:

- Executar operações como treinador, aluno A, aluno B e usuário sem cadastro; confirmar filtragem e rejeições.
- Confirmar email ativo na modalidade real de implantação; verificar ausência de acesso direto à planilha pelos alunos.
- Disparar chamadas reais sobrepostas, com a mesma chave e com chaves diferentes. Verificar um único registro por chave, nenhum item órfão, BUSY recuperável e liberação de lock após erro.
- Repetir chamada após falha de rede; conferir Requests e entidade. Testar recuperação de reserva pendente e divergência de payload.
- Conferir armazenamento literal de textos e datas, respostas serializáveis, cabeçalhos incompatíveis e limites de execução.

Não há comprovação Google nesta etapa. A interface legada segue usando localStorage; não está conectada a esta API. Cloud Run, Gist e bibliotecas gapi legadas não fazem parte do novo backend. Backup e migração dependem de etapa posterior autorizada.
