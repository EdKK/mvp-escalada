# AVA-01C — Privacidade entre sessões

## Referência

Correção na branch `ava-01a-avaliacao-antropometria`, sobre o commit `419aad0ff0f54406ad3125d65d740fe9dc8faa06`. O impedimento da AVA-01B ocorria quando a sessão expirava durante um envio de massa corporal. A tela de treino era ocultada, mas o formulário mantinha os valores no documento e callbacks atrasados ainda podiam alterar seu estado.

## Correção e autoauditoria

| Controle | Verificação |
| --- | --- |
| Encerramento, expiração e troca de identidade | A transição invalida a geração anterior e limpa de imediato massa, data, mensagens, estado de envio e dados do treino. O adaptador detecta a expiração pelo retorno de autorização do servidor. Após autenticação, a data começa no dia atual. |
| Respostas atrasadas | O adaptador verifica a geração antes de processar sucesso, falha de transporte ou erro de autorização. O autorrelato e os fluxos assíncronos de treino também verificam sua geração antes de modificar a interface ou suas intenções. Um erro de autorização antigo deixa a sessão atual ativa. |
| Encerramento com requisições em curso | A revogação é enviada com o token anterior. O estado local é limpo imediatamente e a resposta à revogação pertence à sessão encerrada. Uma operação já recebida pelo servidor pode concluir sob a identidade que a iniciou. |
| Isolamento do reenvio | O identificador da tentativa fica associado ao resumo que inclui o ID do aluno retornado pelo servidor, a ação e os dados. O mesmo valor e data em outra identidade geram outra tentativa. O armazenamento da aba contém apenas chaves derivadas e UUIDs, sem os campos do formulário em texto claro. |
| Recuperação idempotente | Uma resposta antiga não consome o identificador da tentativa. Se a gravação foi concluída e a confirmação se perdeu, o mesmo aluno pode autenticar-se novamente e repetir valor e data na mesma aba. A API usa o recibo existente. O reenvio após recarga depende da disponibilidade de `sessionStorage`. |
| Preservação | O diff não altera código de backend, manifesto, escopos OAuth, esquemas ou contratos RPC. O teste compara todas as tabelas simuladas antes e depois e verifica que o único efeito esperado é um autorrelato por aluno. |

## Arquivos

- `student/google-adapter.js` controla as transições e a validade dos callbacks da sessão.
- `student/app.js` limpa a ficha de treino e invalida efeitos atrasados de carregamento e feedback.
- `student/assessment-intent.js` protege o registro e a remoção de tentativas na fronteira da sessão.
- `apps-script/Student.html`, `apps-script/Index.html` e `demo/student.html` foram atualizados pelo build. O código compartilhado mantém seu comportamento padrão no fluxo do treinador.
- `tests/assessment-privacy-browser.py` cobre a regressão em Chromium com Google simulado.
- `docs/AVA-01C.md` registra a correção e a validação.

## Testes locais

- `node --test tests/*.test.cjs` aprovou os 230 testes.
- `python3 -m unittest discover -s tests -p 'test_*.py'` aprovou os 9 testes do comparador do Apps Script.
- O teste foi executado também na referência em cópia local. A primeira asserção de privacidade falhou porque o valor fictício de 63,5 kg permanecia no formulário após a expiração.
- `python3 tests/assessment-privacy-browser.py` verificou expiração durante o envio, troca de aluno na mesma aba, respostas de sucesso e de expiração atrasadas, dois envios simultâneos com os mesmos dados em identidades diferentes e recuperação da tentativa pelo aluno original.
- Os 14 scripts de navegador passaram em Chromium, incluindo autorrelato, retorno do login, feedback, prescrição e cadastro financeiro.
- `python3 student/build.py` atualizou os HTMLs versionados. `git diff --check` passou e a comparação dos arquivos do backend e do manifesto com a referência ficou vazia.

**Parecer** — correção aprovada na autoauditoria e apta ao novo ensaio em cópia isolada. A validação usou dados fictícios e serviços simulados. A homologação ativa permaneceu intacta e nenhuma implantação foi executada.
