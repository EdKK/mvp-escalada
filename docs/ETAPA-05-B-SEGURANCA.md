# Etapa 05-B — Reconciliação dos inicializadores de homologação

A correção parte de `295c6d0017f11414290af9ee712523bf90d57a96`. O Work confirmou a v19 como versão ativa em homologação. Sua referência histórica é `5e13ba78b6256a51531be8d7f3e0b1081b16e323`.

## Divergências entre o código instalado e a v19

- Segundo o Work, os wrappers públicos `prepararDadosTeste` e `prepararBibliotecaTeste` já existiam na instalação antes do treinamento direcionado e estavam ausentes do GitHub. Com o web app executando como proprietário e disponível antes da autenticação interna, os nomes públicos criavam um caminho potencial de escrita sujeito às proteções dos inicializadores. A auditoria do Work não registrou exploração.
- A diferença instalada de `TrainingLibrary.gs` em relação à v19 é uma quebra de linha final. A atualização desse módulo faz parte da integração funcional do Direcionado.
- Preservar o manifesto instalado, que configura execução como proprietário e acesso anônimo antes da autenticação interna. O manifesto no Git permaneceu idêntico à referência histórica.
- Preservar o nome instalado `StudentLogic` para `Student.gs`. `Auth.gs` também tem nome diferente na instalação, cuja grafia o Work deve confirmar na exportação. Manter um único arquivo por módulo.

## Correção e auditoria

`Homologation.gs` e `TrainingCatalog.gs` registram os wrappers como `prepararDadosTeste_` e `prepararBibliotecaTeste_`, funções de servidor declaradas no nível superior para uso manual pelo editor. Os nomes públicos foram excluídos do candidato. A documentação oficial confirma que o sufixo `_` exclui funções da interface `google.script.run`. O editor oferece seleção e execução de funções. A disponibilidade dos dois nomes no seletor do projeto real deve ser conferida pelo Work sem executá-los. [Funções privadas](https://developers.google.com/apps-script/guides/html/communication#private_functions) · [Execução pelo editor](https://developers.google.com/apps-script/guides/standalone#run_a_standalone_script)

Os corpos dos inicializadores mantêm ambiente, identidade da planilha e bloqueios. A carga de homologação exige IDs coincidentes, verifica o esquema e recusa tabelas populadas. A carga da biblioteca exige o ID explícito e coincidente, valida os esquemas existentes antes da escrita, verifica conflitos no catálogo e conserva os IDs já registrados.

- `api` e `libraryApi` aceitam listas explícitas de ações. A revisão das chamadas encontrou os inicializadores somente nos wrappers privados. A inicialização de esquema fica acessível por código servidor, inclusive pela carga de homologação.
- Em `api`, as ações de autenticação e encerramento de sessão têm tratamento próprio. As operações de dados exigem sessão e usuário ativo. Gravações e leituras aplicam perfil, vínculo do treinador ou titularidade do aluno conforme a operação.
- Em `libraryApi`, a sessão e o usuário ativo são validados. As operações do treinador exigem o treinador ativo configurado. Leituras individuais disponíveis ao aluno verificam titularidade e as prescrições também verificam visibilidade do treino.
- `doGet` serve o HTML do aluno, do treinador ou o retorno OAuth. A revisão não encontrou rota HTTP alternativa ou chamada indireta aos inicializadores. Nenhuma vulnerabilidade adicional impeditiva foi identificada no código auditado.

## Verificações locais

A inspeção estática comparou os módulos com a v19, confirmou os corpos dos inicializadores e revisou as chamadas servidor. A nova suíte Node inventaria as funções globais, verifica os dois wrappers privados e testa as listas de ações, sessão e perfil sem chamar os wrappers. As suítes existentes simulam inicializações somente em planilhas em memória e cobrem as proteções ambientais, esquema, dados existentes e recuperação. Os fluxos autenticados do treinador e do aluno, Fingerboard, blocos de tração, Campus Board, Específico, Geral e Direcionado legado continuam cobertos pelas suítes de regressão, assim como revisões e consistência das gravações.

| Suíte | Linha de base | Candidato | Comando |
|---|---:|---:|---|
| Node | 154 | 156 aprovados | `node --test tests/*.test.cjs` |
| Python | 9 | 9 aprovados | `python3 -B -m unittest discover -s tests -p 'test_*.py'` |
| Chromium | 39 | 39 grupos aprovados | `python3 -B` para cada arquivo `tests/*-browser.py` |

Os grupos Chromium foram 13 de layout, 13 de Direcionado, 9 de ciclo e 4 de Específico. Os navegadores usaram a simulação local.

Os builds `python3 -B demo/build.py` e `python3 -B student/build.py` foram repetidos com hashes idênticos. Os dois HTMLs de demonstração incorporaram o trecho de `Homologation.gs` por geração. O HTML Apps Script do aluno manteve os bytes do commit de partida.

## Arquivos para uma futura atualização autorizada

Preparar os módulos de servidor antes dos clientes e validar o conjunto em uma única versão. A ordem abaixo é de conferência e preparação dos arquivos.

| Ordem | Arquivo no Git | Nome no editor | Dependências ou função | SHA-256 |
|---|---|---|---|---|
| 1 | `TrainingCatalog.gs` | TrainingCatalog | Catálogo e inicialização privada, com proteções de TrainingLibrary | `138581b9cad0afa2a7822582b5e0783d76cd60adacf0e5148199e08b1c9700fd` |
| 2 | `TrainingLoad.gs` | TrainingLoad | Cálculo e validação com funções de catálogo e biblioteca | `1655302e390eefd9120bb9030ccd3efd8e9dba4c5c5dfe55abbbb3422f6055f9` |
| 3 | `TrainingLibrary.gs` | TrainingLibrary | RPC de biblioteca, persistência, Backend, Auth e cálculo | `5ecd3b37bde1fa0acc38fbcbb349c7e86343cb5775c82165cd48043db4d6fdbb` |
| 4 | `CoachLibrary.gs` | CoachLibrary | Prescrição do treinador, TrainingLibrary e TrainingLoad | `67dbb44450f91469440b9e652f03d3248bdc5c1ea64677f8e9202c40b9ae14e8` |
| 5 | `Student.gs` | StudentLogic | Hidratação e feedback, Backend, TrainingLibrary e TrainingLoad | `17f30b9b12338c1ebed6c36272d0da27abd24dde350aa375c22e3e4bbd4b9aae` |
| 6 | `Homologation.gs` | Homologation | Carga privada com as proteções e o esquema de Backend | `80be7640d3bf0e047194004d799df22e9e11542eabfa006748d0b4471d7ee148` |
| 7 | `Index.html` | Index (HTML) | Cliente do treinador, api e libraryApi | `1157fd087e59d27269d56278a1f881a0ecffbc1430cd711708c543859806c2a4` |
| 8 | `Student.html` | Student (HTML) | Cliente do aluno gerado, api e StudentLogic | `645041fa42f0074bbea37de8dcfbd82c60bd0cde957ebe9b8acf0b97db3b16ef` |

Arquivos instalados a preservar: `Auth.gs` sob o nome instalado, `Backend.gs`, `OAuthReturn.html` e `appsscript.json` instalado. A demonstração, a documentação e os testes são locais.

## Verificação pelo Work

1. Exportar a v19 instalada e registrar a versão, o ID e os nomes dos arquivos. Conferir as divergências informadas, os oito hashes do candidato e o manifesto instalado, sem registrar segredos.
2. Em uma cópia isolada autorizada, verificar a presença dos dois nomes privados no editor sem executá-los. Para verificar o bloqueio do cliente na plataforma, usar uma cópia descartável com os corpos dos inicializadores substituídos por funções inertes. Conferir que os nomes públicos antigos e os privados ficam inacessíveis pelo cliente e que apenas as operações autorizadas funcionam para cada perfil.
3. Aplicar o roteiro da Etapa 05 e H01–H14 em homologação autorizada, com contas e dados fictícios. Registrar OAuth e isolamento reais, identidade das planilhas, persistência e recuperação, revisões, contenção de LockService e comportamento em dispositivo físico.

A evidência local e documental permite encaminhar o candidato à nova auditoria pré-implantação. A verificação do seletor do editor e do bloqueio efetivo no serviço do Google permanece pendente.
