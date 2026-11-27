# BIB-13B — prescrição coletiva de musculação

Em Montar treino, inicie uma montagem integral e escolha **Treinamento geral → Musculação**. Selecione os exercícios por região e categoria ou por busca global pelo nome. Preencha cada cartão e adicione o conjunto à montagem. Exercícios já adicionados podem ser editados, excluídos e recuperados na mesma aba pelo mecanismo da v29. A confirmação da sessão envia todos os itens em uma chamada.

## Persistência e 1RM

A musculação usa os identificadores de `CATALOGO_GERAL`. Os campos novos ficam no JSON estruturado de `PRESCRICOES` e a dose executada usa `ItemFeedback` e o registro idempotente em `Requests`. Séries e volume continuam usando `PRESCRICAO_SERIES`. Todas as tabelas e cabeçalhos existentes são preservados. Modelos com musculação usam payload JSON v2. A aplicação continua aceitando modelos v1. A cópia guarda a dose, os campos opcionais e o identificador do exercício. A referência do aluno é resolvida novamente no destino.

Para uma referência de 1RM medida diretamente, use o contrato existente de `recordAssessment` para o identificador estável `mus-…`, com `indicatorId=int-1rm`, `unitId=unit-kg`, valor positivo, protocolo descrito e período de validade. O campo `referenceDefinition` deve ser um dos seguintes, conforme o teste executado.

| Forma e base | Valor de `referenceDefinition` |
| --- | --- |
| Bilateral, carga total | `musculacao:added:bilateral:total` |
| Bilateral, por implemento independente | `musculacao:added:bilateral:per_implement` |
| Unilateral, carga total | `musculacao:added:unilateral:total` |
| Unilateral, por implemento independente | `musculacao:added:unilateral:per_implement` |

A prescrição usa a avaliação ativa mais recente, não substituída, do mesmo aluno e exercício, válida na data e com a mesma forma e base. Um empate na data mais recente, uma referência incompatível, peso corporal ou assistência deixam %1RM em branco, representado por um traço na interface. A carga absoluta continua disponível. O cálculo bilateral e unilateral usa repetições por série e, no caso unilateral, a mesma dose em ambos os lados.

## Implantação e reversão pelo Work

1. Registre a versão numerada da implantação de homologação correspondente à v29 (`45a5f359a7116bd9064f0d719a9dd953fd1b0538`). Confira as configurações de homologação e a aba `CATALOGO_GERAL` já inicializada com os 183 exercícios da [BIB-12B](BIB-12B.md).
2. Adicione `apps-script/StrengthPrescription.gs` e atualize `CoachLibrary.gs`, `TrainingLoad.gs`, `TrainingLibrary.gs`, `Student.gs` (ou o alias já instalado `StudentLogic.gs`, mantendo um único arquivo), `Index.html` e `Student.html` no mesmo projeto. Preserve o manifesto e OAuth. Os arquivos em `student/` são fontes do HTML gerado e `demo/student.html` é a compilação da demonstração.
3. Faça a conferência pontual do contrato do catálogo e das duas telas. Crie uma versão e selecione-a na implantação existente, preservando identificador e URL. Esta etapa usa o catálogo da v29 e dispensa migração ou inicialização de tabelas para a BIB-13B.
4. Para reverter, selecione a versão numerada da v29 no mesmo deployment e preserve todas as abas e linhas. A v29 exibe sessões de musculação e feedback agregado pelos campos genéricos. Os detalhes novos de execução e os modelos JSON v2 ficam disponíveis ao restaurar esta revisão.
