# Autenticação para três contas Gmail pessoais — homologação

## Escolha e fronteira de confiança

A menor mudança segura escolhida preserva interface, tabelas e regras de autorização: substituir a origem da identidade por Google OpenID Connect (OAuth authorization code), usando Apps Script como cliente confidencial e servidor da planilha. Não há acesso direto ao Sheets pelos alunos, senhas Gmail ou servidor adicional. A identidade automática de Session.getActiveUser não é usada nem como fallback.

Google Identity Services no iframe exigiria tratar origens do HtmlService e continuar verificando tokens no servidor. O fluxo por redirecionamento usa somente o URL /exec estável e não depende de configurar origens googleusercontent dinâmicas. Essa escolha ainda requer comprovação prática de OAuth/PKCE/callback no Apps Script; não é declaração de homologação aprovada.

1. A aba original chama beginLogin. O servidor gera state, nonce, PKCE S256 e uma prova independente entregue apenas a essa aba. O estado expira em 10 minutos.
2. O usuário abre o link Google em nova aba, escolhe a conta e consente somente openid/email. A prova não vai no URL.
3. Google retorna código/state ao /exec. O servidor consome state uma vez, troca o código via HTTPS com client secret e code_verifier, e verifica o ID token usando tokeninfo do Google. Valida audience, azp quando presente, issuer, exp, iat, nonce, subject e email_verified. Restringe contas a gmail.com/googlemail.com e confronta email verificado com Users ativo.
4. O callback mostra somente uma mensagem. Não entrega sessão ao navegador de callback. A aba original chama finishLogin com a prova mantida em memória. Isso vincula o resultado ao navegador que iniciou o fluxo e evita que um callback encaminhado a outra pessoa a conecte na conta do iniciador.
5. O servidor cria token opaco de sessão de 30 minutos. CacheService armazena a identidade verificada sob hash do token; o navegador guarda o token apenas em memória e o envia em cada chamada. Logout remove a sessão; inativação em Users é reavaliada imediatamente nas chamadas seguintes. Não há autorregistro.

Nenhum access token/refresh token/ID token Google é persistido ou devolvido ao cliente. Tokeninfo recebe o ID token somente por requisição HTTPS do servidor (query da API Google); não registrar URLs/respostas desse fluxo. Código de autorização aparece no URL de callback como parte do protocolo, é consumido uma vez e nunca é armazenado pelo aplicativo. Editores do projeto são administradores confiáveis e podem ler Script Properties; não adicionar alunos como editores.

Gmail é autoritativo para seus emails e seus endereços não são reciclados. O sub verificado é conservado na sessão; a associação com IDs existentes continua pelo email Gmail verificado exato, sem alterar Users. Não normalizar pontos/aliases automaticamente. Contas externas/Workspace são rejeitadas nesta configuração deliberadamente; ampliar isso exigirá revisar a vinculação de identidade.

## Configuração manual Google (somente teste)

1. Criar projeto Google Cloud exclusivo de homologação, separado de produção. Em Google Auth Platform/tela de consentimento, configurar audiência Externa, status Testing e adicionar **somente os três Gmail de teste controlados** como test users. Não publicar o consentimento para produção. Solicitar openid e email, sem escopos Drive/Sheets para esses usuários. As contas reais entram apenas no Google e na planilha de homologação, nunca no Git.
2. Criar cliente OAuth do tipo Aplicativo da Web. Seu client secret é credencial do aplicativo, não senha Gmail. Não criar conta de serviço. Não são necessárias origens JavaScript para este fluxo servidor.
3. No Apps Script, copiar os cinco arquivos e usar o manifesto novo. Criar implantação Web App de teste executada como proprietário. Para Gmail externos, acesso precisa permitir esses usuários: preferir “Qualquer pessoa com uma Conta Google”, se disponível. Se a conta oferecer somente “Qualquer pessoa”, o shell/login será acessível sem login, mas a API de dados continua exigindo OAuth e Users ativo; usar exclusivamente dados fictícios e projeto de teste. Se políticas impedirem acesso externo, há bloqueio manual e não se deve compartilhar a planilha para contornar.
4. Copiar o URL exato /exec da implantação. Cadastrar esse mesmo URL em URIs de redirecionamento autorizados do cliente OAuth. Não usar /dev nem URL do iframe googleusercontent. Em Script Properties definir GOOGLE_REDIRECT_URI igual ao /exec; GOOGLE_CLIENT_ID; GOOGLE_CLIENT_SECRET; ENVIRONMENT=homologation. Manter SPREADSHEET_ID e HOMOLOGATION_SPREADSHEET_ID apontando para a planilha vazia exclusiva de teste.
5. Autorizar o projeto como proprietário para spreadsheets e script.external_request. Nenhum aluno deve autorizar o escopo Sheets do projeto proprietário; a tela OAuth deles deve solicitar somente identidade/email. Não é preciso compartilhar a planilha ou o código. Atualizar a implantação de teste com a nova versão mantendo o deployment ID/redirect. Se mudar o ID da implantação, atualizar as duas configurações de redirect juntas.
6. Carregar dados fictícios com seedHomologation_ apenas se a planilha estiver vazia. Se a carga anterior já existe, não executá-la de novo. Na aba Users, trocar somente os emails fictícios pelos três Gmail controlados. Guardar tudo fora do repositório.

A associação do Apps Script a um projeto GCP padrão próprio pode ser exigida pela conta/política para controle de consentimento e quotas; configurar no editor se solicitado. O cliente OAuth pode ser do projeto Cloud exclusivo. Aprovação do administrador, OAuth, verificação do redirect e autorização do proprietário não podem ser feitas pelos testes Node.

## Uso no iPhone

No Safari, abrir /exec; tocar Preparar entrada com Google; tocar Continuar no Google (nova aba). Escolher o Gmail de teste correto. Após a mensagem de conclusão, voltar à aba original e tocar Concluir entrada. Manter a aba original aberta: a prova não é persistida. Se expirar ou a aba for recarregada, preparar nova entrada. Sair do MVP limpa dados visíveis e revoga a sessão; para trocar de conta iniciar nova entrada e selecionar outro Gmail. Login em nova aba evita depender de popups disparados depois de uma chamada assíncrona. Cookies, navegação entre abas e comportamento do Safari precisam de teste real.

## Limites e testes obrigatórios

Esta configuração bloqueia OAuth fora de ENVIRONMENT=homologation. Tokeninfo é um mecanismo de verificação remota para esta homologação pequena, com dependência de disponibilidade/quotas Google; não é projeto de autenticação pronto para produção. Documentação Google recomenda bibliotecas de verificação em produção. Não há refresh tokens ou renovação silenciosa. CacheService pode perder estados antes do TTL; novo login é a recuperação segura. O limite global é 20 preparações/minuto, sob lock; não constitui proteção completa contra abuso do shell público. Scripts/planilha/Cloud devem continuar restritos aos administradores.

Testes locais cobrem protocolo com HTTP simulado, PKCE, prova por navegador, state de uso único, audiência/emissor/expiração/nonce/email inválidos, cadastro, logout, expiração/evicção de cache e ausência de fallback para o proprietário. **Não verificam assinaturas Google reais**, consentimento, quotas, rede, URLs autorizadas ou interface visual. Executar os casos do procedimento HOMOLOGACAO.md no Google, acrescentando: consentimento recusado; conta não listada nos test users/Users; callback repetido; tentativa com prova de outra aba; expiração e logout; falha tokeninfo; seleção de conta e duas abas no iPhone. Nunca liberar dados reais com base apenas nos testes simulados.

Referências:

- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/cache/cache
