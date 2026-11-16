# Base segura — etapa 1

Implementação independente: os cinco arquivos originais permanecem intactos. Inclui interface isolada para homologação; não há implantação, migração ou acesso a dados reais.

## Contrato e esquema

`api(request)` é o único ponto de entrada remoto, destinado a `google.script.run` em uma futura interface HtmlService. `doGet` serve Index.html via HtmlService, sem publicar o projeto. Não há API HTTP de dados nem `doPost`. Funções com sufixo `_` são privadas para RPC do Apps Script.

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
6. Copiar também Index.html para o projeto, com nome Index. Nenhum aplicativo é publicado nesta entrega. Chamadas pelo editor comprovam apenas a identidade do operador. Homologação RPC usará esta interface em implantação de teste posteriormente autorizada.

## Concorrência, repetição e recuperação

Todas as operações usam ScriptLock (inclusive consultas) para obter uma visão consistente entre chamadas deste projeto. A escrita reserva ID e fingerprint em Requests e faz flush antes de gravar a entidade. Nova tentativa com a mesma chave e conteúdo retorna o registro existente ou completa a gravação pendente. Conteúdo diferente retorna CONFLICT. Autorizações são reavaliadas antes de uma repetição. Requests não deve ser limpo sem política de retenção: remover chaves elimina proteção contra duplicidade.

Sheets não tem transações ACID. Falhas podem deixar reservas pendentes, recuperáveis pela mesma requisição. Chaves diferentes podem criar treinos semelhantes: deduplicação é por intenção (requestId), não por aluno/data. Bloqueios não coordenam edição manual ou outros projetos Apps Script. Não compartilhar a escrita com outro projeto. Não há exclusão, atualização, auditoria completa, paginação ou rollback automático nesta etapa. Leituras completas e bloqueio global limitam escala; medir quotas e volume antes de produção. Requests guarda conteúdo normalizado para comparação: restringir acesso e definir retenção antes de dados reais.

## Testes e critérios de homologação

Executar da raiz: `node --test tests/*.test.cjs` (Node 18+). Sem dependências npm. Os serviços Google são substituídos por objetos locais: os testes NÃO comprovam execução real, identidade Google, quotas, persistência ou concorrência distribuída.

Cobertura local: identidade ausente/usuário inativo, isolamento entre alunos, permissão de treinador/vínculo, escrita por aluno, dados inválidos/fórmulas, idempotência de treino e item, conflito de chave, recuperação após falha parcial, contenção de lock e proteção de esquema.

Homologação pendente, em planilha de teste:

- Executar operações como treinador, aluno A, aluno B e usuário sem cadastro; confirmar filtragem e rejeições.
- Confirmar email ativo na modalidade real de implantação; verificar ausência de acesso direto à planilha pelos alunos.
- Disparar chamadas reais sobrepostas, com a mesma chave e com chaves diferentes. Verificar um único registro por chave, nenhum item órfão, BUSY recuperável e liberação de lock após erro.
- Repetir chamada após falha de rede; conferir Requests e entidade. Testar recuperação de reserva pendente e divergência de payload.
- Conferir armazenamento literal de textos e datas, respostas serializáveis, cabeçalhos incompatíveis e limites de execução.

Não há comprovação Google nesta etapa. A interface legada segue usando localStorage, preservada. Index.html é a versão conectada à API. Cloud Run, Gist e bibliotecas gapi legadas não fazem parte do novo backend. Backup e migração dependem de etapa posterior autorizada.


## Integração da interface — segunda entrega

Index.html reaproveita estilos e formulários de index.html sem modificá-lo. TreinoID e autoria são definidos no servidor; alunos vinculados são selecionados por ID, sem exposição de emails. O servidor informa o papel em getSession. A interface disponibiliza criação e itens para treinador, envio de retorno para aluno e consulta de treino/retornos para ambos, sempre com autorização revalidada no backend.

Novas operações:

- getSession, data {} → {id, role}.
- listStudents, data {} → [{id}], apenas treinador com vínculos ativos.
- submitFeedback, requestId, data {workoutId, status, reason?, fingerPain, rpe, comment?}. Apenas aluno proprietário; status Concluído/Parcial/Não fez; motivo obrigatório nos dois últimos; dor inteira 0–10 e RPE inteiro 1–10.
- listFeedback, data {workoutId} → retornos autorizados do treino.

A nova aba Feedback é criada por initializeSchema_ sem modificar as existentes. Campos: id, workoutId (Workouts), studentId (Users), status, reason, fingerPain, rpe, comment, createdAt. Não executar inicialização em planilha real nesta etapa.

Intensidade do item é preservada como texto identificado nas notas, junto às notas do treinador; o esquema de Items existente não é alterado. A análise estruturada de intensidade permanece pendente. Cada submissão intencional de retorno pode criar um novo registro; repetições com a mesma chave são idempotentes.

O adaptador google.script.run usa success/failure handlers e mensagens de erro sem detalhes de transporte. Chaves de repetição são mantidas em memória para o mesmo payload após erro; recarregar a página perde essas chaves. Não há armazenamento local de dados ou credenciais. Os botões são bloqueados durante operações, e conteúdos retornados usam textContent. Não há importação, exclusão ou sincronização Gist nessa versão. O painel de consulta compartilhado mantém o visual original; as abas de troca de papel são ocultadas e os papéis vêm do servidor.

Testes locais adicionais exercitam retornos, permissões, validação, idempotência, recuperação de escrita, sessão/listagem de alunos e adaptador RPC com respostas simuladas. A sintaxe do JavaScript integrado é verificada. Não houve teste visual em navegador nem execução end-to-end no Google: testar formulário por formulário com contas distintas, seleção de treino, falha/repetição, atualização de dados, isolamento e chamadas simultâneas reais na homologação. O aplicativo bloqueia ações quando não está no Apps Script ou quando a identidade é indisponível.
