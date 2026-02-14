# Configuração do Google Sheets

Este documento contém instruções detalhadas sobre como configurar o Google Sheets com o Google Cloud Platform (GCP) e os passos necessários para uma implementação bem-sucedida.

## Configuração do Projeto GCP
1. Acesse o Console do Google Cloud: [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto clicando em 'Selecionar um projeto' e depois em 'Novo projeto'.
3. Dê ao seu projeto um nome significativo e configure a organização, se necessário.
4. Anote o ID do projeto, pois você precisará dele mais tarde.

## Ativando APIs
1. No Console do Google Cloud, navegue até a seção 'APIs e Serviços'.
2. Clique em 'Biblioteca'.
3. Pesquise por 'Google Sheets API' e clique nela.
4. Clique em 'Ativar' para habilitar a API no seu projeto.
   - Você também pode precisar ativar outras APIs relevantes, como a Google Drive API.

## Configuração da Tela de Consentimento OAuth
1. Vá para 'APIs e Serviços' > 'Tela de Consentimento OAuth'.
2. Configure a tela de consentimento como 'Externa'.
3. Preencha os campos obrigatórios, como o nome do aplicativo, endereço de e-mail de suporte, etc.
4. Clique em 'Salvar e continuar'.

## Criação do ID do Cliente OAuth
1. Vá para 'APIs e Serviços' > 'Credenciais'.
2. Clique em '+ Criar Credenciais' e selecione 'ID do Cliente OAuth'.
3. Escolha 'Aplicativo da Web' como tipo de aplicativo.
4. Na seção 'Origens JavaScript autorizadas', adicione `https://EdKK.github.io`.
5. Clique em 'Criar'.
6. Salve o ID do Cliente e o Segredo do Cliente.

## Criação de Conta de Serviço
1. Acesse 'IAM e Admin' > 'Contas de Serviço'.
2. Clique em 'Criar Conta de Serviço'.
3. Dê um nome à conta e defina as permissões necessárias. Para Cloud Run, você precisará das permissões apropriadas.
4. Clique em 'Concluído'.

## Instruções de Implantação para Cloud Run
1. No Console do Google Cloud, acesse Cloud Run.
2. Clique em 'Criar Serviço'.
3. Selecione uma imagem do container ou configure uma nova.
4. Defina as permissões, variáveis de ambiente e outras configurações necessárias.
5. Clique em 'Criar'.

## Melhores Práticas de Segurança
- Sempre valide e sanitize todos os dados recebidos do cliente.
- Armazene secrets (como senhas e IDs) em um gerenciador seguro de segredos, como o Secret Manager do GCP.
- Configure CORS (Cross-Origin Resource Sharing) adequadamente para sua aplicação.

## Guia de Solução de Problemas
1. **Problema de Autenticação:** Verifique se o ID do Cliente e o Segredo estão corretos.  Verifique as credenciais na tela de consentimento.
2. **Erros de API:** Consulte os registros de erro no Console do Google Cloud para detalhes sobre falhas específicas.
3. **Problemas de Permissão:** Certifique-se de que a conta de serviço tem permissões necessárias para acessar o serviço Google Sheets e outras APIs relevantes.