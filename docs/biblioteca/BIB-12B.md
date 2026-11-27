# BIB-12B — catálogo consultivo de musculação

A edição v1 do catálogo contém 183 exercícios em 14 categorias. A aba `CATALOGO_GERAL` usa as colunas `id`, `area`, `region`, `category` e `name`. Os identificadores `mus-…` são fixos e independentes dos identificadores de prescrição. Preserve-os ao revisar os nomes ou a ordem em uma edição futura.

## Implantação em homologação pelo Work

1. Na implantação web de homologação, registre a versão numerada correspondente à v28 (`0dc639d831dbbbf82c1cb99e6027bd0365a8ec41`) para reversão. Confirme que `ENVIRONMENT` vale `homologation` e que `SPREADSHEET_ID` e `LIBRARY_SPREADSHEET_ID` apontam para a mesma planilha de homologação autorizada.
2. A partir do commit candidato, adicione `apps-script/GeneralCatalog.gs` e atualize `apps-script/TrainingLibrary.gs` e `apps-script/Index.html` no mesmo projeto. Preserve as configurações de OAuth e o manifesto.
3. No editor do Apps Script, execute `prepararCatalogoGeralHomologacao_`. A carga vazia cria uma única aba e insere 183 linhas de exercícios. Em uma carga completa, o resultado informa `inserted: 0` e `total: 183`. Uma carga parcial compatível recebe apenas os registros faltantes. Cabeçalhos incompatíveis, duplicatas ou registros divergentes interrompem a rotina para conferência, sem sobrescrever as linhas existentes.
4. Crie uma versão e selecione-a na implantação web de homologação existente, preservando seu identificador e URL. Faça a conferência pontual com uma conta de treinador em **Biblioteca → Treinamento geral → Musculação → Membros inferiores → Pés**. Confirme os 12 exercícios, a busca por `halux` e que Montar treino continua exibindo o catálogo de prescrição. A validação automatizada já foi executada sobre o candidato.
5. Se precisar reverter, edite a mesma implantação e selecione a versão numerada da v28 registrada no primeiro passo. Mantenha `CATALOGO_GERAL` e os dados existentes. A v28 ignora a nova aba.

A consulta usa `listGeneralCatalog` no RPC autenticado da Biblioteca. A inicialização é exclusiva do editor e toda a navegação é somente leitura.
