# MVP Escalada — backend e interface de homologação

Os cinco arquivos originais na raiz permanecem intactos. Apps Script serve Index.html; a interface chama api por google.script.run. A planilha é privada ao proprietário. Nenhum dado é migrado e nenhuma implantação é feita por este repositório.

## Instalação e identidade

Seguir [HOMOLOGACAO.md](../docs/HOMOLOGACAO.md) e [AUTENTICACAO-GMAIL.md](../docs/AUTENTICACAO-GMAIL.md). **A configuração atual substitui a dependência de Session.getActiveUser por OAuth Google explícito**, adequado às três contas Gmail pessoais de teste. Não depende de domínio Workspace. Não usar os procedimentos antigos de login automático.

Arquivos a copiar para o projeto Apps Script: Backend.gs, Auth.gs, Homologation.gs, Index.html e appsscript.json. Executar como proprietário; alunos não recebem acesso ao script ou à planilha. Configuração e credenciais OAuth ficam somente em Script Properties. Não há senha Gmail, refresh token ou credencial Google no navegador/repositório.

## Esquema

Cabeçalhos exatos estão em SCHEMA_ de Backend.gs. Inicialização cria somente abas ausentes; cabeçalhos incompatíveis causam erro sem limpeza. seedHomologation_ exige propriedades explícitas de homologação e todas as tabelas sem registros; cria treinador, dois alunos, dois vínculos, dois treinos e dois itens fictícios. Emails example.invalid devem ser substituídos apenas na planilha pelas contas Gmail controladas. Não executar a carga sobre dados existentes.

| Aba | Identidade e relacionamentos |
| --- | --- |
| Users | id único; email único ativo; role coach/student; active booleano |
| Links | id único; coachId/studentId → Users; active booleano |
| Workouts | id UUID; coachId/studentId → Users |
| Items | id UUID; workoutId → Workouts |
| Feedback | id UUID; workoutId → Workouts; studentId → Users |
| Requests | id UUID; par userId/key único; entity/entityId da gravação reservada |

Users e Links são administrados exclusivamente na planilha. A identidade Google verificada é confrontada com Users em toda chamada. Não há cadastro remoto de usuários ou papéis. IDs e timestamps das entidades são gerados no servidor. Treinadores acessam apenas treinos próprios com vínculo ativo; alunos leem seus treinos e enviam retornos somente para eles.

## Contrato RPC

api recebe {action, data, requestId?, sessionToken?}; responde {ok:true,data} ou {ok:false,error:{code}}. Somente beginLogin/finishLogin são pré-login. logout revoga a sessão indicada. Demais ações exigem sessão opaca válida. Funções com sufixo _ são privadas para RPC.

- beginLogin, data {} → {transaction, proof, authorizationUrl}.
- finishLogin, data {transaction, proof} → {pending:true} ou {sessionToken}.
- logout, data {} e sessionToken → {signedOut:true}.
- getSession, data {} → {id, role}.
- listStudents, data {} → [{id}], somente treinador com vínculos ativos.
- listWorkouts, data {} → treinos visíveis.
- getWorkout, data {workoutId} → treino e itens; inexistência e falta de acesso retornam NOT_FOUND.
- createWorkout, requestId, data {studentId, date, goal}.
- addItem, requestId, data {workoutId, block, category, exercise, metric, quantity, minutes, notes?}.
- submitFeedback, requestId, data {workoutId, status, reason?, fingerPain, rpe, comment?}.
- listFeedback, data {workoutId} → retornos autorizados do treino.

Campos desconhecidos são rejeitados. Datas YYYY-MM-DD; quantidade/minutos numéricos 0–100000. Retorno: status Concluído/Parcial/Não fez; motivo obrigatório nos dois últimos; dor inteira 0–10; RPE inteiro 1–10. Textos não podem começar por indicadores de fórmula, inclusive após espaços. Renderização usa textContent. Intensidade do item é preservada nas notas, sem modificar o esquema anterior.

## Concorrência e limites

Todas as chamadas API usam ScriptLock; gravações reservam ID/fingerprint em Requests antes de inserir a entidade. Repetições com mesma chave/conteúdo retornam a entidade ou completam escrita pendente; conteúdo diferente retorna CONFLICT. Permissões são revalidadas. Requests não deve ser limpo sem política de retenção. Chaves diferentes representam intenções diferentes, mesmo para o mesmo aluno/data.

Sheets não oferece transações ACID. Bloqueios não coordenam edição manual ou outros projetos. Leituras completas, bloqueio global, UrlFetch e tokeninfo impõem limites; esta implementação é destinada à homologação pequena. CacheService pode perder entradas antecipadamente: sessões/entradas falham de forma fechada e exigem novo login. Não há exclusão, atualização, paginação ou auditoria completa.

A interface guarda sessão e chaves de repetição apenas em memória. Recarregar a página exige novo login e perde chaves; evitar reenviar uma intenção já confirmada. Sair revoga a sessão MVP; não desloga a conta Google. Não há importação, exclusão nem sincronização Gist na nova interface.

## Validação

Da raiz: node --test tests/*.test.cjs (Node 18+). tests/package.json isola os testes do package.json legado inválido, que permanece preservado. Não instalar dependências legadas.

Testes usam serviços Google substitutos e não comprovam assinatura/tokeninfo reais, troca OAuth, identidade, persistência, interface em navegador ou concorrência distribuída. O protocolo de homologação documenta os testes reais pendentes, incluindo consentimento, sessões por Gmail, expiração, falhas e Safari. Não há comprovação Google nem publicação nesta entrega.
