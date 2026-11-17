# Relatório de homologação controlada — Etapa 1

**Situação geral: PENDENTE. Recomendação: APROVAÇÃO CONDICIONADA, sem liberação da Etapa 2.**

Data: 17/11/2026 (America/Sao_Paulo). Repositório EdKK/mvp-escalada. Branch `feature/biblioteca-exercicios`.

- Commit de referência solicitado e efetivamente examinado: `013e3199f7984728259fb39d63b36aeddac0a8f6`.
- Commit com as correções pontuais e seis testes adicionais: `298098253d4c60a5b6cffcc4802dae731f0481ca`.
- Base de compatibilidade: `cd4eb6b48868a0bcf054aef5901ca42d7cde078b` (`feature/backend-seguro`).
- `main` preservada em `a9eb8c1d1d902d87cda4af9e4eda8ee764ce0b49`. Não houve merge, implantação, migração ou execução da Etapa 2.

## 1. Escopo, ambiente e significado dos resultados

Foram executadas verificações de código e testes locais com serviços Apps Script/Google Sheets substituídos por objetos em memória. Todos os usuários, referências, avaliações e sessões desses testes são fictícios. Nenhuma planilha Google foi lida ou escrita durante esta homologação.

Não foi identificada uma implantação Apps Script de desenvolvimento com projeto/URL e planilha independente autorizados para execução nesta sessão. As ferramentas conectadas de Sheets não fornecem execução das funções Apps Script; não foi encontrada ferramenta de execução Apps Script. Não se procuraram credenciais, não se usaram planilhas pessoais desconhecidas e não se tentou executar código contra uma implantação presumida. Consequentemente, **nenhum resultado local é apresentado como teste real Google**.

Classificações utilizadas:

- **APROVADO**: verificação efetivamente executada e satisfeita no ambiente indicado na linha.
- **REPROVADO**: comportamento incorreto reproduzido, com evidência registrada.
- **NÃO EXECUTADO**: verificação sem evidência de execução; inclui todos os testes reais no Google nesta sessão.

A aprovação local não satisfaz por si só o critério de homologação final.

## 2. Execuções e evidências

| Execução | Ambiente | Aprovados | Reprovados | Observação |
| --- | --- | ---: | ---: | --- |
| Suíte original no commit de referência | Local simulado | 61 | 0 | `NODE_DISABLE_COMPILE_CACHE=1 node --test tests/*.test.cjs`, antes de qualquer correção. |
| Seis casos adicionais aplicados ao código de referência | Local simulado | 3 | 3 | Dois casos de revogação e um de timestamp reproduziram falhas não cobertas pela suíte original. |
| Suíte completa após correções | Local simulado | **67** | **0** | `NODE_DISABLE_COMPILE_CACHE=1 node --test --test-reporter=tap tests/*.test.cjs`. Sem testes ignorados/cancelados. |
| Execuções Apps Script/Sheets reais | Google | 0 | 0 | **NÃO EXECUTADO**; zero falhas não significa aprovação. |

Artefatos de evidência:

1. [TAP da execução final](evidencias/homologacao-local.tap): resultado individual dos 67 testes, ambiente local.
2. [Resultados numéricos e inventário](evidencias/casos-locais.json): valores realmente produzidos pelos validadores em memória, contagens, igualdade após segunda inicialização e hashes SHA-256 dos arquivos de código/teste avaliados; declara explicitamente `googleAppsScriptExecuted:false`.
3. [Casos controlados adicionais](../../tests/library-homologation.test.cjs): reprodução das três reprovações anteriores e reteste, acesso A→B, adulteração de IDs, recuperação após persistir somente parte das séries e integridade dos relacionamentos.
4. [Suíte da biblioteca](../../tests/library.test.cjs) e [fixtures dos quatro exemplos](../../tests/fixtures/library-examples.json): validações funcionais originais.

A execução dos seis casos adicionais contra o código sem correção retornou:

- `controlled E: assessment replay rechecks a revoked trainer-student link`: REPROVADO; `ok:true` quando se esperava recusa.
- `controlled E: prescription replay cannot return or repair data after access revocation`: REPROVADO; repetição reparou/devolveu registro apesar do vínculo revogado.
- `controlled D/F: Sheets Date values preserve timestamps and date-only assessment fields`: REPROVADO; `2026-11-17T13:45:12.123Z` foi reduzido para `2026-11-17`.
- Os outros três casos passaram. Essa contagem refere-se apenas aos seis casos novos, não a uma execução da suíte completa naquele ponto.

Nenhum token ou credencial foi persistido nas evidências. A prova de identidade emitida pelo Google não foi exercitada; as sessões locais são geradas pelo ambiente de teste.

## 3. Matriz dos requisitos A–F

| ID | Requisito | Resultado local efetivamente observado | Classificação local final | Google real |
| --- | --- | --- | --- | --- |
| A1 | Estrutura e relacionamentos | Dez tabelas novas presentes; IDs sem duplicação; associações exercício↔método/capacidade e referências de catálogo resolvem. Testes `controlled A/B...` e `hand moves are totals only...`. | APROVADO | NÃO EXECUTADO |
| A2 | Inicializar duas vezes | Conteúdo serializado de todas as tabelas em memória permanece idêntico; todos os registros legados preservados. Cabeçalhos incompatíveis bloqueiam escrita e carga parcial pode ser retomada. | APROVADO | NÃO EXECUTADO |
| B1 | Dez exercícios e recuperação | listExercises retorna dez; getExercise e cadastro novo/replay funcionam; identificadores únicos. | APROVADO | NÃO EXECUTADO |
| B2 | Diferentes métodos e capacidades | Associações N:N exercitadas sem duplicar o exercício. | APROVADO | NÃO EXECUTADO |
| B3 | Duplicidade | Variações de acento, caixa e espaços são rejeitadas, inclusive quando existe só reserva após falha de gravação. | APROVADO | NÃO EXECUTADO |
| C1 | Quatro exemplos | Totais observados 168/50/80/15, com as unidades indicadas na seção 4. | APROVADO | NÃO EXECUTADO para RPC/persistência Google |
| C2 | Grau não vira percentual | V4/V-scale preservados; alvo numérico ausente; percent sobre grau rejeitado. | APROVADO | NÃO EXECUTADO |
| C3 | Campus sem fórmula indefinida | Indicador descritivo retorna methodologyPending; nenhum alvo numérico; percent adicional rejeitado. | APROVADO | NÃO EXECUTADO |
| D1 | Referência do aluno | Referência ausente/de outro aluno/incompatível/vencida para a sessão/substituída rejeitada; tipos e unidades testados. | APROVADO | NÃO EXECUTADO |
| D2 | Histórico | Prescrição antiga mantém snapshot de 100 kg depois de uma avaliação de 110 kg; linhas antigas preservadas. Timestamp Date mantém hora após correção F02. | APROVADO | NÃO EXECUTADO |
| E1 | Treinador autorizado | Alunos não administram; dois treinadores ativos bloqueiam administração. | APROVADO | NÃO EXECUTADO |
| E2 | Isolamento A↔B e IDs | Casos B→A da suíte original e A→B adicionais recusados; item de outra sessão e campos de identidade adulterados rejeitados. | APROVADO | NÃO EXECUTADO |
| E3 | Sessão ausente | Requisições sem sessão válida recusadas no simulador. | APROVADO | NÃO EXECUTADO para autenticação Google |
| E4 | Permissão reavaliada no replay | Avaliação/prescrição não são devolvidas nem reparadas após revogação de vínculo. Era REPROVADO na referência; corrigido em F01. | APROVADO | NÃO EXECUTADO |
| F1 | Suíte completa e regressão | 67/67 após correções, incluindo os 45 testes anteriores à biblioteca. | APROVADO | NÃO EXECUTADO para uso real das telas |
| F2 | Repetição e falhas parciais | Mesma chave conserva IDs; falha depois da primeira série é retomada, sem duplicar filhos; reservas bloqueiam concorrente com revisão/nome conflitante. | APROVADO | NÃO EXECUTADO |
| F3 | Concorrência | Contenção de lock e revisão concorrente simuladas, retornos BUSY/CONFLICT esperados. Não foram disparadas duas execuções Google reais. | APROVADO no simulador | NÃO EXECUTADO |
| F4 | Preservação | Nenhum arquivo anterior de OAuth/telas/contratos foi modificado; apenas TrainingLibrary.gs recebeu correções. Não houve acesso a planilhas reais. | APROVADO para arquivos/testes locais | NÃO EXECUTADO para dados de uma planilha de desenvolvimento |

**Teste A no Google Sheets:** NÃO EXECUTADO. A segurança/idempotência da inicialização real ainda não foi comprovada. Essa pendência impede considerar a Etapa 1 homologada.

## 4. Resultados calculados — dados fictícios

| Caso | Referência fictícia | Intensidade observada | Volume observado | Classificação local |
| --- | --- | --- | --- | --- |
| Repeaters | Força máxima de 400 N, protocolo explícito | 60%, alvo 240 N | 4×6×7 = **168 segundos de suspensão** | APROVADO |
| Max hangs | Força máxima de 400 N, protocolo explícito | 90%, alvo 360 N | 5×1×10 = **50 segundos de suspensão** | APROVADO |
| Boulder 4×4 | Grau ordinal com escala V-scale | **V4**, sem percentual/alvo numérico | 4×4×5 = **80 movimentos de mão** | APROVADO |
| Supino | 1RM de 100 kg, protocolo explícito | 85%, alvo 85 kg | 5×3 = **15 repetições** | APROVADO |

Não houve soma entre unidades nem equiparação de estímulos entre referências. O campus não é submetido a cálculo de intensidade não definido. São evidências de cálculo de software, não validação fisiológica das prescrições.

Inventário observado após inicialização local: CAPACIDADES 14; METODOS 15; UNIDADES 14; INDICADORES 7; EXERCICIOS 10; EXERCICIO_CAPACIDADES 26; EXERCICIO_METODOS 38; AVALIACOES/PRESCRICOES/PRESCRICAO_SERIES sem registros antes dos cenários. Essas são linhas de dados, sem contar cabeçalhos. Após repetir a inicialização, todos os conteúdos permaneceram idênticos.

## 5. Falhas, gravidade e correções separadas

| ID | Gravidade | Falha e causa | Correção | Situação |
| --- | --- | --- | --- | --- |
| F01 | Alta — autorização | libraryWrite_ devolvia registro já persistido e reparava filhos antes de revalidar o vínculo corrente. O replay reutilizava uma autorização antiga. Reproduzido para avaliação e prescrição após desativar o vínculo no simulador. | Reavaliar libraryStudent_ para AVALIACOES/PRESCRICOES e workout_ para PRESCRICOES **antes** de devolver/reparar registros. | REPROVADO em 013e3199; APROVADO no reteste local de 2980982; validação Google pendente. |
| F02 | Média — integridade temporal | libraryRows_ truncava qualquer Date para YYYY-MM-DD, inclusive createdAt. | Só assessedOn/validUntil ficam como data; timestamps conservam ISO completo. | REPROVADO em 013e3199; APROVADO no reteste local de 2980982; tipos/fusos reais Sheets pendentes. |
| L01 | Baixa — limitação preexistente de ferramentas | package.json legado da raiz é inválido. Um script Node avulso na raiz encontrou ERR_INVALID_PACKAGE_CONFIG; a suíte oficial funciona sob tests/package.json. | Nenhuma alteração, para preservar arquivos e escopo. Evidência numérica foi gerada com resolução de módulos a partir de tests/. Não instalar dependências legadas. | Limitação registrada; não impede a suíte oficial. |

Alterações de correção: somente apps-script/TrainingLibrary.gs e novo tests/library-homologation.test.cjs, commit 2980982. Nenhuma ampliação de escopo funcional, coluna, modelo de dados ou interface. Relatório/evidências são arquivos novos, em commit separado. O commit de referência **não deve ser promovido sem essas correções**.

## 6. Compatibilidade e preservação

As APIs existentes, Auth.gs, Backend.gs, Student.gs, interfaces HTML/CSS/JavaScript, manifesto e arquivos originais da raiz permanecem byte a byte iguais ao commit de referência. As correções afetam somente o módulo novo. Nenhuma estrutura Sheets foi alterada. Os 45 testes anteriores continuam passando, e os 16 testes originais da biblioteca também.

O vínculo entre novo domínio e telas continua como documentado na Etapa 1: não há integração automática da biblioteca com os painéis nem gravação de execução por série. Isso não foi ampliado nesta homologação. Preservação de arquivos e regressão simulada não são prova de funcionamento visual ou persistência no ambiente Google.

## 7. Roteiro operacional indispensável no Google

Todos os passos desta seção: **NÃO EXECUTADO**. Usar apenas dados fictícios, projeto/implantação de desenvolvimento e planilha independente. As instruções detalhadas de RPC estão também em [VALIDACAO.md](VALIDACAO.md); aplicar o código corrigido de 2980982, não apenas a referência sem correções.

### Preparação e propriedades

1. Identificar explicitamente o projeto Apps Script de teste, a implantação de desenvolvimento e seu proprietário. Se não existirem, criar projeto e planilha novos e independentes; não copiar registros de produção. Não apontar rotinas para uma planilha de treinamento existente.
2. Confirmar visualmente que a planilha contém apenas dados fictícios e é privada ao proprietário. Conferir identidade do projeto e correspondência dos IDs pelas configurações, sem registrá-los em logs públicos.
3. Propriedades necessárias: ENVIRONMENT=`homologation`; SPREADSHEET_ID=ID da planilha independente; LIBRARY_SPREADSHEET_ID=mesmo ID. Para a carga fictícia antiga, HOMOLOGATION_SPREADSHEET_ID=mesmo ID. Manter GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI somente no Google e apenas do ambiente de teste. Não imprimir valores nem adicioná-los ao repositório.
4. Usar os módulos atuais preservados e TrainingLibrary.gs/TrainingLoad.gs/TrainingCatalog.gs corrigidos. Se a base estiver vazia, executar initializeSchema_ e seedHomologation_; esta última recusa repetir sobre tabelas com dados. Não apagar dados para contornar uma recusa. Se já houver base fictícia compatível, reutilizá-la sem nova carga.
5. Para as chamadas autenticadas, três contas Google controladas de teste em Users/Links, exatamente um treinador ativo. Manter o algoritmo OAuth existente. Se for necessário configurar ambiente novo, seguir AUTENTICACAO-GMAIL.md em projeto/clientes de teste separados; não alterar a configuração de produção. Não registrar emails nas evidências; usar os IDs fictícios hom-coach/hom-student-a/hom-student-b.
6. A atualização necessária para testar RPC deve ser feita **somente na implantação de desenvolvimento identificada**. Nenhuma implantação foi realizada por esta entrega. Se não for possível verificar isolamento, parar e manter NÃO EXECUTADO.

### Execução, evidência e recuperação por teste

| Teste | Função/operação a executar | Resultado esperado | Evidência mínima a registrar (sem segredos) | Recuperação segura |
| --- | --- | --- | --- | --- |
| A | initializeLibraryDevelopment_ duas vezes; comparação integral de conteúdo/IDs entre execuções. | Dez tabelas novas com cabeçalhos corretos; catálogo conforme seção 4; segunda execução idêntica; abas legadas intactas. | Data, versão do código, contagens antes/depois, hashes e booleans de igualdade; execução real Apps Script identificada por referência privada. | Se erro de cabeçalho/configuração, parar. Não limpar/renomear/reescrever tabelas. Corrigir apenas a configuração do projeto de teste após confirmar isolamento; repetir a inicialização para retomar carga parcial. Se não houver segurança, usar outra planilha nova, preservando a anterior. |
| B | libraryApi catalog/listExercises/getExercise; createExercise e linkExerciseMethod/linkExerciseCapacity com nomes e IDs fictícios. | Dez exemplos recuperáveis; vínculo N:N; repetição com mesma chave devolve o mesmo ID; outro cadastro de nome normalizado retorna CONFLICT. | Contagens e IDs técnicos fictícios dos exemplos, códigos de resposta e igualdade de IDs; sem sessão ou payloads pessoais. | Em falha de rede, repetir a mesma chave e conteúdo. Não gerar outra chave para a mesma intenção; não apagar linhas reservadas. |
| C | validateLoad para os quatro fixtures; depois createLibraryPrescription/getLibraryPrescription com itens fictícios autorizados. | Volumes 168 s/50 s/80 movimentos/15 rep; alvos 240 N/360 N/V4/85 kg, nas referências fictícias. Percent em grau e campus rejeitado. | Valores/unidades efetivamente devolvidos, escala V-scale e ausência de alvo numérico no grau/campus. | Preservar requisição original. Erro de referência/unidade deve ser corrigido na intenção de teste nova, não alterando avaliação histórica. |
| D | recordAssessment; referências ausente, de outro aluno, unidade/tipo incompatível, vencida e supersedida; criar/reler prescrição histórica. | Rejeições corretas; snapshot antigo conserva referência original; timestamps completos e campos de data corretos no fuso da planilha. | Códigos, IDs fictícios e comparações de snapshots/valores antes/depois; datas sem dados pessoais. | Criar avaliação nova com supersedesId; nunca sobrescrever a antiga. Se houve erro de serialização, guardar o caso e suspender aprovação. |
| E | Sessões reais das três contas; A tenta ler B e vice-versa; usuário sem sessão; aluno tenta administrar; IDs de item/sessão trocados; replay com vínculo de teste revogado. | FORBIDDEN/NOT_FOUND/UNAUTHENTICATED ou bloqueio Google conforme operação. Após revogação, replay não devolve registro nem repara filhos. | Papel e IDs fictícios, código de resposta e contagens de filhos; nenhum token, email, cookie ou secret. | Como administrador, restaurar somente o booleano original do vínculo fictício depois da verificação; não tocar vínculos reais. Se não autorizado consegue acesso, interromper imediatamente e classificar REPROVADO. |
| F | Duas sessões/chamadas reais com a mesma intenção; repetir requisição; cenário de gravação interrompida em projeto descartável de teste. | Uma entidade por chave; filhos sem duplicação; BUSY/CONFLICT quando aplicável; mesma chave retoma com os mesmos IDs. | Dois resultados reais, IDs fictícios, número de entidades/filhos e registro das execuções sobrepostas. | Repetir mesma chave após a falha. Não apagar Requests/entidades/séries. Não provocar indisponibilidade em produção nem instalar injeção de falhas no projeto existente. Se não houver projeto descartável seguro para falhas, manter essa parte NÃO EXECUTADO. |

O formulário do app não expõe libraryApi nesta etapa. Usar o procedimento de console do frame HtmlService descrito em VALIDACAO.md, sem imprimir os objetos login/auth/proof/sessionToken. Executar pelo editor como proprietário não comprova o papel de aluno: E exige contas realmente distintas. Dois chamadas locais sequenciais ou um mock BUSY não comprovam concorrência distribuída Google.

### Auxílio opcional para a evidência real do Teste A

Somente em um **arquivo novo no projeto de teste confirmado**, um operador pode usar esta função auxiliar e executá-la manualmente. Este trecho **não foi executado no Google** e não integra o produto. Ele não imprime conteúdo, IDs de planilha ou credenciais; apenas igualdade e contagens. Usa os guards existentes antes de qualquer inicialização.

```js
function homologarInicializacaoEtapa1_() {
  var db = libraryDb_(); // exige as propriedades de desenvolvimento corretas
  function assinatura(sheet) {
    var values = sheet.getLastRow() ? sheet.getDataRange().getValues() : [];
    return hashAuth_(JSON.stringify(values));
  }
  function capturar() {
    var out = {};
    db.getSheets().forEach(function(s) { out[s.getName()] = assinatura(s); });
    return out;
  }
  var antes = capturar();
  initializeLibraryDevelopment_();
  var primeira = capturar();
  initializeLibraryDevelopment_();
  var segunda = capturar();
  var preservado = Object.keys(antes).every(function(n) { return primeira[n] === antes[n] && segunda[n] === antes[n]; });
  var igual = Object.keys(primeira).length === Object.keys(segunda).length &&
    Object.keys(primeira).every(function(n) { return primeira[n] === segunda[n]; });
  var contagens = {};
  Object.keys(LIBRARY_SCHEMA_).forEach(function(n) { contagens[n] = libraryRows_(db,n).length; });
  console.log(JSON.stringify({ambienteVerificado:true, registrosAnterioresPreservados:preservado, segundaInicializacaoIdentica:igual, contagens:contagens}));
  if (!preservado || !igual) throw new Error('HOMOLOGACAO_INICIALIZACAO_REPROVADA');
}
```

Se antes já existiam tabelas novas parcialmente carregadas, a primeira execução pode legitimamente completá-las: nesse caso registrar quais eram essas tabelas e comparar preservação das linhas já existentes, sem considerar a adição esperada como sobrescrita. Para uma prova inicial simples, usar base legada fictícia pronta e nenhuma tabela da biblioteca. Não usar a função auxiliar com planilhas reais.

## 8. Critério final e recomendação

| Critério de aprovação | Situação |
| --- | --- |
| Testes automatizados relevantes | APROVADO localmente: 67/67 após as correções. |
| Cálculos e unidades dos exemplos | APROVADO nos validadores locais; persistência/RPC reais NÃO EXECUTADOS. |
| Controle de acesso | APROVADO nos testes simulados após F01; validação com contas Google reais NÃO EXECUTADA. |
| Inicialização segura/idempotente no Sheets de desenvolvimento | NÃO EXECUTADO no Google, portanto ainda não comprovado. |
| Dados/funcionalidades anteriores preservados | APROVADO para arquivos e regressão simulada; verificação de planilha real de desenvolvimento NÃO EXECUTADA. |

**Recomendação técnica: aprovação condicionada das correções e da etapa local, mantendo a homologação geral PENDENTE.** Não iniciar a Etapa 2 enquanto A–F essenciais no Google não tiverem evidências reais, especialmente inicialização dupla, permissões das três contas e recuperação/concorrência. Se qualquer caso real falhar, registrá-lo como REPROVADO e corrigir pontualmente antes de nova avaliação. Não há autorização implícita para merge ou implantação em produção.
