# Comparação de versões e sincronização controlada — diagnóstico e preparação

> **Procedimento histórico da Etapa 1.** As instruções e hashes abaixo registram a instalação em 4c6b2b0. Para a Etapa 2, seguir [INTEGRACAO-TREINADOR.md](INTEGRACAO-TREINADOR.md): Index.html e dois módulos devem ser atualizados, e CoachLibrary.gs deve ser adicionado. O manifesto REFERENCIA-SINCRONIZACAO.json e o comparador agora usam a referência da Etapa 2, indicada no próprio manifesto; seus resultados incluem quatro módulos da biblioteca. Não aplicar à Etapa 2 a orientação histórica de manter Index.html inalterado.

Repositório EdKK/mvp-escalada, branch feature/biblioteca-exercicios. Referência de código fixada: **4c6b2b0e4c6a2cd19affda2d5665928f44cb599a**. Essa referência inclui as correções 2980982 de autorização no replay e preservação dos timestamps.

**Nesta execução: somente leitura do código existente e criação de documentação/ferramentas locais. Nenhum arquivo Google foi lido ou sincronizado, nenhuma propriedade foi alterada, nenhum segredo foi acessado, nenhuma inicialização/implantação foi executada. Homologação real permanece PENDENTE.**

## 1. Fatos e pendências

Verificado no repositório:

- Os três módulos corrigidos existem; a referência 4c6b2b0 inclui 2980982. Código antigo, OAuth e interfaces não precisam ser alterados pela inclusão da biblioteca.
- A nova entrada é libraryApi(request), separada de api(request). Usa sessão e autorização existentes.
- libraryDb_ exige ENVIRONMENT=homologation e LIBRARY_SPREADSHEET_ID=SPREADSHEET_ID; exige cabeçalhos legados de Users, Links, Workouts, Items e Requests.
- As declarações globais de funções dos três módulos não colidem com Backend/Auth/Homologation/Student do repositório. LIBRARY_SCHEMA_ é o único novo objeto de esquema global; as outras funções internas usam o prefixo library ou o nome initializeLibraryDevelopment_.
- Não há .clasp.json, rotina de push Apps Script, pipeline GitHub Actions ou automação de implantação configurados no repositório. Os geradores Python existentes só geram HTML local.
- O relatório anterior registra 67 testes locais aprovados; esses testes não comprovam execução no Google.

Informações fornecidas pelo proprietário, não reconferidas diretamente nesta sessão:

- Existência do projeto e da planilha chamados MVP Escalada - Homologação, lista de oito arquivos e propriedades configuradas.
- StudentLogic.gs corresponde integralmente a apps-script/Student.gs. **Preservar StudentLogic.gs e não adicionar Student.gs.**
- Planilha contém apenas dados fictícios. Isso ainda não comprova isolamento em relação à produção.

Não disponível: conteúdos instalados de Backend/Auth/Homologation/manifesto, export atual do projeto, prova de que produção usa outro projeto/planilha e evidências Google A–F. Não considerar a comparação externa concluída com base em nomes de arquivos.

## 2. Matriz de compatibilidade

| Arquivo instalado/alvo | Situação | Dependências | Ação necessária |
| --- | --- | --- | --- |
| Backend.gs | A verificar no Google; compatível no repositório | Helpers, esquema legado e api | Comparar conteúdo/assinaturas; preservar. Se incompatível, parar e propor correção separada, sem substituição automática. |
| Auth.gs | A verificar no Google; compatível no repositório | Sessões OIDC, CacheService, UrlFetchApp, Utilities e propriedades OAuth | Comparar código, sem exportar propriedades. Preservar autenticação. |
| Homologation.gs | A verificar; não é dependência de execução da biblioteca | Backend e dados fictícios; guard HOMOLOGATION_SPREADSHEET_ID | Comparar/preservar; não executar novamente a carga sobre dados existentes. |
| StudentLogic.gs | Compatível segundo comparação confirmada pelo proprietário; não reexecutada nesta sessão | Mesmo módulo que Student.gs do repositório | Preservar este nome/conteúdo; não criar a cópia Student.gs. |
| appsscript.json | A verificar no Google | V8, timezone e escopos existentes | Comparar; não substituir por diferenças de formatação ou por simples adição da biblioteca. |
| Index.html, Student.html, OAuthReturn.html | Não precisam mudar para a biblioteca | Interface/auth existentes | Preservar e registrar hashes antes/depois. |
| TrainingLibrary.gs | Novo; referência local corrigida conferida | Backend, Auth, Sheets e lock | Adicionar somente se o nome ainda não existir e os gates de segurança passarem. |
| TrainingLoad.gs | Novo; referência local conferida | TrainingLibrary, backend, avaliações e entidades do catálogo | Adicionar a versão fixada, sem adaptar fórmulas. |
| TrainingCatalog.gs | Novo; referência local conferida | TrainingLibrary, backend, Properties/Sheets/Lock | Adicionar; não executar initializeLibraryDevelopment_ nesta preparação. |

Assinaturas externas obrigatórias da biblioteca:

| Origem no repositório | Funções |
| --- | --- |
| Backend.gs | fail_(code), text_(v,max), fields_(obj,allowed), db_(), sheet_(db,name), rows_(db,name), append_(db,name,obj), enabled_(v), userForEmail_(db,email), linked_(db,coach,student), workout_(db,user,id), id_() |
| Auth.gs | sessionIdentity_(token) → identidade com email verificado na sessão |
| Serviços Google | PropertiesService.getScriptProperties().getProperty; SpreadsheetApp.openById/flush e métodos de abas/intervalos; LockService.getScriptLock com tryLock/waitLock/hasLock/releaseLock; Utilities.getUuid via id_ |

StudentLogic/Student não é dependência direta dos três módulos novos; continua necessário aos fluxos legados do app. Homologation também não é chamada automaticamente pela biblioteca. Os módulos novos não exigem novo escopo OAuth: o manifesto de referência usa V8, spreadsheets e script.external_request (este último já usado pela autenticação). Não mudar cliente, callback, escopos ou lógica de autenticação apenas para adicionar a biblioteca.

Os nomes não bastam: helpers instalados devem manter validação, envelope e autorização equivalentes. Verificar também declarações globais em arquivos adicionais. Uma cópia Student.gs junto de StudentLogic.gs duplicaria funções mesmo que os conteúdos fossem iguais.

## 3. Estratégia recomendada e referência por hash

**Preferir inclusão manual dos três arquivos**, com export/cópia antes e depois e comparação SHA-256. É a menor alteração, não demanda token adicional nem introduz acesso remoto de escrita.

clasp pode ser avaliado no futuro, mas não é necessário para três arquivos. Não há configuração pronta; adotá-lo exigiria instalação, autorização de conta, identificação do script, regras de exclusão e revisão do conjunto enviado. Um push amplo poderia afetar arquivos existentes, manifestos ou nomes. Não executar clasp push/pull/deploy nesta etapa, nem guardar .clasprc.json, credenciais ou Script Properties no Git.

Referência auditável: [REFERENCIA-SINCRONIZACAO.json](REFERENCIA-SINCRONIZACAO.json), gerada dos bytes de código do commit aprovado (não dos arquivos Google).

| Módulo | SHA-256 UTF-8 esperado |
| --- | --- |
| TrainingLibrary.gs | 5ec7fb2f4bf302755c1311ceda5f05341e5c72eaa68354ba80da9ce0e419db0f |
| TrainingLoad.gs | cb43348b5adab86ce1daabeff62b8d8327b12e670ea06145f392fc8ba7e1320f |
| TrainingCatalog.gs | 2b06771ec3a1d750f39afff126a3a2b5041333c7fb722f232ab1be1b0354ecc0 |

## 4. Método local de comparação (sem acesso Google)

O proprietário deve fornecer cópias atuais do **conteúdo do editor**, não arquivos simplesmente baixados do GitHub e rotulados como instalados. Nenhuma propriedade, token, captura de credencial ou ID de projeto é necessária.

Opções:

1. Copiar cada arquivo do editor para arquivos locais de mesmo nome, em pasta privada fora do checkout. Preservar texto, acentos, final de arquivo e quebras de linha. Guardar os oito arquivos existentes; depois da inclusão, guardar os onze. Não incluir Student.gs quando já existe StudentLogic.gs.
2. Usar um export JSON de código fornecido pelo proprietário, no formato files:[{name,type,source}], como o retorno de projects.getContent da API oficial. O repositório **não busca esse export** e esta opção não autoriza configurar ou chamar essa API agora.

A ferramenta [tools/compare_apps_script.py](../../tools/compare_apps_script.py) usa apenas Python padrão, não executa o código recebido, não usa rede, não lê Script Properties e não escreve nas cópias. Só lê nomes conhecidos; não imprime fonte/diff, IDs de projeto, credenciais ou mensagens de erro contendo conteúdo. Recusa symlinks nos arquivos conhecidos. Metadados de export não são exibidos. As cópias e relatórios com hashes observados devem ficar privados; não versionar exports de projeto ou configurações.

Da raiz do repositório:

```sh
# Confere apenas a referência local; NÃO é uma comparação com Google.
python3 -B tools/compare_apps_script.py

# Compara cópias do editor fornecidas pelo proprietário.
python3 -B tools/compare_apps_script.py --installed /caminho/privado/copia-antes
python3 -B tools/compare_apps_script.py --installed /caminho/privado/copia-depois

# Alternativa: JSON de código exportado pelo proprietário.
python3 -B tools/compare_apps_script.py --installed /caminho/privado/export.json
```

Resultados:

- IDENTICO_BYTES: bytes UTF-8 e SHA-256 da cópia coincidem com a referência.
- DIFERENTE_APENAS_FIM_DE_LINHA: conteúdo equivalente após normalizar CRLF/CR para LF, mas **não é identidade de bytes**. É diagnóstico, não aprovação automática.
- DIFERENTE: precisa de revisão; não imprime linhas nem autoriza sobrescrever o arquivo.
- AUSENTE_NA_COPIA: pode significar módulo novo ainda não adicionado ou export incompleto. Confirmar no editor.
- DUPLICIDADE_DE_MODULO: ambas StudentLogic.gs e Student.gs foram fornecidas; parar e revisar o namespace. A ferramenta não elimina nenhuma.
- sameManifestJson=true apenas indica JSON equivalente; não se deve sobrescrever o manifesto por diferença cosmética.
- unknownServerFilesCount>0 exige revisão manual de arquivos extras/possíveis colisões; a ferramenta não prova ausência de colisões em código desconhecido.

Sem --installed, todos ficam NAO_COMPARADO e liveGoogleVerified=false. Com cópias, comparisonOrigin=COPIAS_FORNECIDAS e liveGoogleVerified continua false: hash não prova a origem da cópia nem qual versão está implantada. A procedência deve ser conferida pelo proprietário. Código de saída 0 significa referência íntegra no modo só referência, ou identidade completa das cópias no modo instalado; 1 indica diferença/ausência/duplicidade e 2 erro de entrada/referência.

Antes da inclusão, é esperado que os três módulos estejam ausentes. Depois, exigir libraryFilesExact=true e integridade da referência. Comparar installedSha256 dos oito arquivos anteriores entre os resultados antes/depois: devem permanecer iguais. Se os arquivos antigos forem compatíveis mas diferirem do GitHub em formatação, pode haver allExpectedFilesExact=false; isso não autoriza reescrevê-los. A revisão de compatibilidade deve resolver e documentar a diferença. Não aceitar diferença de conteúdo nos três módulos novos como correspondência exata.

## 5. Gates de ambiente e segredo exposto (ações manuais futuras)

Antes de salvar qualquer arquivo no Google:

1. Pelo proprietário, conferir o projeto pelo identificador no editor e no inventário privado de implantações. Abrir a configuração da implantação usada em produção e comparar a origem. Os projetos de produção e homologação devem ser diferentes. O nome exibido e ENVIRONMENT=homologation não comprovam segregação.
2. Confirmar que a planilha apontada no projeto de teste não é a de produção; revisar todas as abas, inclusive ocultas, fórmulas/importações e fontes que possam introduzir dados reais. Registrar apenas confirmação/contagens de dados fictícios, nunca conteúdo pessoal.
3. Conferir localmente, na interface Google, a correspondência dos IDs de SPREADSHEET_ID e HOMOLOGATION_SPREADSHEET_ID, sem publicá-los. Se houver dúvida, parar; não trocar o apontamento de um projeto possivelmente compartilhado para tentar isolá-lo.
4. **Script Properties são compartilhadas por todas as versões/implantações do mesmo projeto.** Criar uma versão ou outra implantação no mesmo projeto não isola propriedades, planilha nem código executado pelo editor. Se produção usa esse projeto, a sincronização está bloqueada até segregação expressamente autorizada.
5. Somente depois dessas provas será permitido planejar LIBRARY_SPREADSHEET_ID igual ao SPREADSHEET_ID de teste. A ausência atual é uma barreira de execução, não um defeito a contornar antes de provar isolamento.

Segundo o pedido, um segredo OAuth apareceu em uma captura. Tratá-lo como exposto. A substituição é **manual no Google Cloud Console**, após identificar o cliente e seus projetos dependentes, sem enviar o valor antigo/novo ao Codex ou ao Git. Se o cliente for compartilhado com produção, coordenar a rotação com o responsável; não mudar somente uma propriedade e quebrar os outros consumidores.

No ambiente separado e autorizado, gerar/substituir o segredo conforme os controles disponíveis no Console, atualizar GOOGLE_CLIENT_SECRET exclusivamente nas configurações dos consumidores identificados e invalidar o segredo exposto. Confirmar login real no projeto de teste. Não alterar o algoritmo OAuth, não colar segredo no código, não capturar a tela com valores e não restaurar o segredo comprometido em uma reversão. Esta rotação não foi realizada nesta execução.

## 6. Checklist exato de sincronização futura no editor

**Procedimento preparado, não executado. Requer autorização posterior e aprovação dos gates acima.**

1. Obter a referência dos três arquivos em apps-script/ do commit fixado no manifesto; conferir SHA-256 local. Não usar 013e3199 sem as correções posteriores.
2. Exportar/copiar os oito arquivos atuais do projeto Google para um backup privado novo, sem propriedades. Registrar privadamente a versão implantada anterior e confirmar que ela é de homologação. Não sobrescrever backup anterior.
3. Executar a comparação de cópias e resolver as pendências de Backend/Auth/Homologation/manifesto; manter StudentLogic conforme a confirmação do proprietário. Verificar funções/assinaturas da seção 2. Se faltar helper ou houver colisão, parar e produzir análise de diferença, sem substituir os arquivos atuais.
4. No editor do projeto **comprovadamente exclusivo de homologação**, usar + > Script e criar TrainingLibrary (gera .gs); colar apenas o conteúdo de TrainingLibrary.gs. Repetir para TrainingLoad e TrainingCatalog. Se algum nome já existir, parar: não sobrescrever.
5. Salvar. Não clicar em Executar. Não criar Student.gs, não renomear StudentLogic.gs, não modificar Backend/Auth/Homologation/HTMLs/manifesto e não adicionar os arquivos legados da raiz do repositório.
6. Copiar/exportar novamente os onze arquivos diretamente do editor e comparar. Os três hashes novos devem ser os esperados; os oito hashes anteriores devem permanecer iguais aos do backup. Revisar arquivos extras se houver. A comparação valida o código salvo no editor, não uma versão implantada.
7. Com o projeto e a planilha já validados, configurar manualmente LIBRARY_SPREADSHEET_ID=SPREADSHEET_ID no ambiente isolado. Preservar as demais propriedades; não revelar valores.
8. Registrar confirmação de integridade, nomes dos módulos, commit e resultado da comparação. Não incluir credenciais, IDs privados ou export bruto em logs públicos.
9. Encerrar a sincronização sem inicializar nem implantar. Submeter a evidência para autorizar a homologação real A–F.

## 7. Reversão sem apagar arquivos ou dados

Antes de inicialização/implantação, a sincronização é apenas aditiva. Em caso de incompatibilidade, parar chamadas da biblioteca e não executar funções pelo editor. Preservar os três arquivos adicionados e os backups; não apagar/renomear arquivos ou editar funções para “anular” o módulo. Os arquivos anteriores devem continuar intactos, o que é comprovado pelos hashes antes/depois.

Se uma implantação de teste tiver sido atualizada em uma etapa posteriormente autorizada, o proprietário poderá apontar **somente essa implantação** para a versão imutável anterior já registrada. Isso restaura o código servido daquela implantação, não o conteúdo atual do editor nem as propriedades compartilhadas. Impedir execuções manuais da biblioteca enquanto o diagnóstico estiver aberto.

Para bloquear o novo módulo, o proprietário poderá, em uma ação de reversão autorizada e **apenas no projeto isolado**, desabilitar o gate LIBRARY_SPREADSHEET_ID voltando à condição ausente anterior; não tocar em SPREADSHEET_ID, ENVIRONMENT ou configurações OAuth. O app legado não depende dessa propriedade. Não executar essa reversão se ainda houver dúvida sobre compartilhamento do projeto.

Caso uma inicialização tenha sido autorizada e executada em etapa futura, não apagar abas, Requests ou registros para simular rollback. Voltar o código não reverte os dados. Preservar as tabelas, registrar contagens e investigar; a rotina foi feita para retomar carga parcial. Se necessário, uma nova planilha de teste independente deverá ser autorizada separadamente, preservando a anterior. Nunca reativar o segredo OAuth exposto para recuperar uma versão antiga.

## 8. Momento seguro para homologação A–F

Executar initializeLibraryDevelopment_ somente após: isolamento comprovado, conteúdo fictício revisado, dependências/cabeçalhos compatíveis, código salvo com os três hashes conferidos, gate configurado e autorização expressa de execução. A rotina do editor não exige implantação, mas faz escritas reais e não deve ser usada nesta preparação.

Sequência futura:

1. **A:** capturar hashes/contagens e executar initializeLibraryDevelopment_ duas vezes; comparar registros/IDs, inclusive abas anteriores, usando o auxílio do RELATORIO-HOMOLOGACAO.md. Não repetir seedHomologation_ em base já populada. Se a base legada estiver ausente, parar e autorizar sua preparação separadamente.
2. Atualizar apenas a implantação de teste, com nova versão do código salvo, se for usar RPC nas contas de teste; manter URL de callback e identidade de execução existentes. Isso é outra ação, não parte da inclusão manual nem da presente autorização.
3. **B:** biblioteca/associações/duplicidades e IDs com libraryApi; não pelos formulários atuais, que ainda não expõem esse módulo.
4. **C:** validar os quatro fixtures e suas unidades: 168 s, 50 s, 80 movimentos e 15 repetições; graus/campus sem percentuais indevidos.
5. **D:** avaliações ausentes/incompatíveis/vencidas/substituídas; preservação dos snapshots e timestamps.
6. **E:** três sessões Google reais distintas; aluno A/B, treinador, sessão ausente, IDs manipulados e replay após revogação. Executar como proprietário no editor não comprova identidade de aluno.
7. **F:** repetições e concorrência reais; falhas induzidas somente em projeto descartável autorizado, sem apagar dados ou instalar injeção de falha no projeto existente.

Registrar APROVADO/REPROVADO/NÃO EXECUTADO por caso e tipo de evidência. Os 67 testes locais e os novos testes da ferramenta de comparação não homologam o Google. Não iniciar Etapa 2.

## 9. O que o Codex pode realizar agora e o que depende do usuário

| Ação | Responsável/condição |
| --- | --- |
| Auditar código do repositório, assinaturas, referências e hashes | Codex; realizado nesta preparação. |
| Criar método de comparação offline e documentação | Codex; realizado, sem sincronização. |
| Comparar cópias atuais exportadas do Google | Codex quando o proprietário fornecer cópias de código sem segredos; pendente. |
| Provar isolamento de projeto/planilha, conferir dados e implantações de produção | Proprietário nas interfaces Google; pendente. |
| Rotacionar segredo e autorizar contas | Proprietário no Google Cloud/Apps Script; pendente, sem compartilhamento do segredo. |
| Adicionar módulos e configurar gate | Proprietário no editor, só em execução posteriormente autorizada. |
| Executar inicialização/RPC e coletar evidência real | Proprietário no Google, com roteiro e apoio analítico do Codex; não há ferramenta de execução Apps Script disponível nesta sessão. |
| Sincronização remota/implantação automática | Não preparada nem executada; clasp não foi introduzido. |

## 10. Verificações locais desta preparação

- Referência: hashes locais coincidem com o commit fixado; nenhuma comparação Google foi declarada concluída.
- Ferramenta offline: oito testes Python aprovados com arquivos sintéticos; não são exports Google. Comando: python3 -B -m unittest discover -s tests -p test_compare_apps_script.py.
- Suíte de produto: 67 testes locais aprovados novamente com NODE_DISABLE_COMPILE_CACHE=1 node --test tests/*.test.cjs; nenhum arquivo de produto foi alterado. A homologação real permanece pendente.

Arquivos novos: este documento, REFERENCIA-SINCRONIZACAO.json, tools/compare_apps_script.py e tests/test_compare_apps_script.py. Nenhum arquivo anterior foi sobrescrito.
