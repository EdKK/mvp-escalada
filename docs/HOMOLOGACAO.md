# Homologação real — instalação manual reproduzível

## Condição de identidade (verificada na documentação Google)

Fonte: https://developers.google.com/apps-script/reference/base/session#getActiveUser()

O Google informa que o email ativo normalmente não está disponível em web apps executados como o desenvolvedor, com exceção geral para usuários do mesmo domínio Google Workspace. Portanto:

- Configuração candidata: proprietário e três contas de teste **do mesmo domínio Workspace**, executar como proprietário, acesso restrito ao domínio. A planilha fica privada ao proprietário. O administrador pode bloquear esse modelo: comprovar com cada conta antes de aprovar.
- Contas pessoais Gmail ou externas ao domínio: o modelo atual **não garante identidade** mantendo a planilha privada. Se getSession retornar UNAUTHENTICATED, interromper a homologação multiusuário. Será necessário outro mecanismo de identidade verificada, fora desta preparação.
- Executar como usuário que acessa não resolve o requisito: requer permissões do usuário para abrir a planilha; não compartilhar a planilha com alunos para contornar isso.
- Nunca substituir identidade ativa pela efetiva, nem informar email pelo cliente. Não usar acesso anônimo. Somente testar a conta proprietária não comprova funcionamento multiusuário.

## Instalação (computador recomendado para a configuração inicial)

1. Obter os arquivos da branch feature/backend-seguro do PR #3. Criar uma planilha **nova, vazia e exclusiva de teste**, nome sugerido MVP Escalada — HOMOLOGAÇÃO. Manter acesso geral Restrito, sem alunos ou treinadores convidados. Não selecionar planilha existente ou de produção.
2. No script.google.com, criar projeto independente de homologação com a conta proprietária do domínio. Adicionar arquivos de script Backend e Homologation copiando os respectivos .gs; adicionar arquivo HTML Index copiando Index.html. Remover apenas o conteúdo padrão do projeto recém-criado, não arquivos do repositório. Em Configurações do projeto, habilitar exibição do manifesto; substituir o manifesto padrão por appsscript.json. Não copiar index.html da raiz nem bibliotecas legadas.
3. Adicionar propriedades do script: ENVIRONMENT = homologation; SPREADSHEET_ID = ID da nova planilha; HOMOLOGATION_SPREADSHEET_ID = o mesmo ID. O ID fica entre /d/ e /edit no endereço da planilha. Esses valores reais ficam só no Google, nunca em commits.
4. Salvar e executar seedHomologation_ pelo editor; autorizar acesso à planilha e identidade da conta proprietária. A rotina cria cabeçalhos e dados fictícios, sem limpar ou substituir células. Se alguma tabela já tiver registros, recusa a carga: inspecionar manualmente; em caso de carga parcial usar outra planilha vazia e atualizar as duas propriedades, sem apagar a anterior. Não há recuperação automática da carga de teste.
5. Na aba Users, substituir **somente** os três emails example.invalid por três contas Google de teste controladas no mesmo domínio (uma para treinador, duas para alunos). Manter IDs, papéis, cabeçalhos e booleanos. Não usar contas de alunos reais. Não versionar esses emails. Dados fictícios não fazem login: contas Google autenticadas são indispensáveis.
6. Implantar > Nova implantação > Aplicativo da Web. Executar como **Eu (proprietário)**; Quem pode acessar: somente usuários do domínio Workspace (o texto varia por conta). Descrição HOMOLOGAÇÃO. Se essa opção não existir, interromper e revisar as políticas/contas. Não usar Todos/anônimo. Autorizar apenas os escopos do manifesto. Copiar o URL /exec desta implantação de teste e compartilhar somente com os três testadores controlados, nunca com usuários reais. A API ainda impede contas do domínio não cadastradas.
7. Abrir /exec em três sessões separadas, cada qual com uma conta. O link /dev é de teste para editores e não comprova acesso dos alunos sem acesso ao projeto. Não dar permissão de editor do projeto aos alunos. Após alterações de código, criar nova versão em Gerenciar implantações e atualizar somente esta implantação de homologação.

## iPhone

A configuração inicial e os testes de chamadas negativas requerem computador. No iPhone, abrir o URL /exec no Safari, autenticar na conta de teste correta e confirmar o ID mostrado no campo Aluno (hom-student-a/b). Para trocar usuário, usar perfis/sessões separados ou sair da conta anterior; abas comuns compartilham sessão e navegação privada não garante separação de identidades. Repetir os testes com uma conta por vez. Evitar navegadores embutidos em mensageiros. Se houver erro de cookies/redirecionamento, repetir em Safari e registrar a conta efetivamente usada; não enfraquecer autenticação ou permissões. Instalar/copiar arquivos pelo iPhone usando “Solicitar Site para Computador” é alternativa sem garantia de usabilidade; preferir computador para essa fase.

## Protocolo de aprovação (registrar resultado, data, papel e evidência sem emails)

Todos os testes abaixo estão PENDENTES até execução no Google. Testes Node são simulações e não substituem este protocolo.

| Caso | Ação | Resultado obrigatório |
| --- | --- | --- |
| H01 identidade | Abrir /exec com treinador e cada aluno | IDs/papéis distintos hom-coach, hom-student-a, hom-student-b; nenhuma identidade herdada do proprietário |
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
| H12 usuário ausente | Conta do domínio não cadastrada; depois teste sem login | FORBIDDEN para não cadastrado; bloqueio Google/UNAUTHENTICATED sem identidade |
| H13 vínculo | Proprietário marca vínculo A inativo e treinador tenta consultar/criar | Treinador perde acesso ao treino A e criação para A; restaurar apenas o booleano de teste |
| H14 iPhone | Executar H03–H06 pelo Safari com aluno A | Formulários utilizáveis, persistência e histórico iguais ao computador |

Para H07–H11 usar console do navegador no computador, selecionando o frame da aplicação HtmlService (google.script.run precisa estar definido). Não executar a API no editor como se fosse aluno: isso mede identidade do operador.

Exemplo de chamada, dentro do frame, com login do aluno A:

```js
google.script.run.withSuccessHandler(console.log).withFailureHandler(console.error)
  .api({action:'getWorkout', data:{workoutId:'hom-workout-b'}});
// Esperado: {ok:false,error:{code:'NOT_FOUND'}}
```

Exemplo de repetição/concorrência para aluno A (reutilizar literalmente a chave):

```js
const req = {action:'submitFeedback', requestId:'hom-feedback-repeat-01',
  data:{workoutId:'hom-workout-a',status:'Concluído',reason:'',fingerPain:0,rpe:5,comment:'Teste fictício de repetição'}};
const send = () => google.script.run.withSuccessHandler(console.log).withFailureHandler(console.error).api(req);
send(); send();
```

Conferir linhas e IDs como proprietário. Não registrar emails, cookies, tokens ou conteúdo de contas reais em evidências. Nunca considerar H11 aprovado somente porque o teste local de lock passou. A perda das chaves em memória ao recarregar a interface é uma limitação conhecida: para H10 usar a chave explícita acima.

## Impedimentos e encerramento

Dependem de ação manual: criação de contas/projeto/planilha, consentimento OAuth, políticas Workspace, seleção da identidade de execução, implantação restrita e observação das identidades reais. Não há prova de funcionamento Google no repositório. Se H01 ou H02 falhar, não prosseguir para usuários reais; documentar a modalidade de implantação e revisar autenticação. Após os testes, arquivar a implantação de homologação quando não for mais necessária; preservar evidências sem dados pessoais. Esta etapa não autoriza migração, implantação em produção ou merge.
