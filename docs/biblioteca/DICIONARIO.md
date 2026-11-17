# Dicionário de dados — biblioteca e fundamentos de carga

O [dicionário CSV completo](DICIONARIO.csv) enumera todos os campos físicos novos, tipos, unidades, obrigatoriedade e FKs. Os cabeçalhos em LIBRARY_SCHEMA_ são o contrato executável; não criar colunas manualmente fora dessa definição.

## Legado reaproveitado (sem alterações)

| Entidade lógica | Aba/campos | Tipos e regras |
| --- | --- | --- |
| ALUNOS | Users.id, email, role, active | IDs/string e email de autenticação existente; role=student; active booleano. Nenhum email real é incluído no código/catálogo. |
| Vínculo | Links.id, coachId, studentId, active | Strings referenciam Users; active booleano. Exatamente um treinador ativo administra o módulo novo. |
| SESSOES | Workouts.id, coachId, studentId, date, goal, createdAt | IDs string; date YYYY-MM-DD; goal texto; createdAt ISO timestamp. Aluno vem do registro autorizado. |
| Item da sessão | Items.id, workoutId, block, category, exercise, metric, quantity, minutes, notes, createdAt | Contrato legado intacto. PRESCRICOES complementa o item por itemId, não substitui o texto ou os números legados. |
| EXECUCOES legado | ItemFeedback.id, workoutId, itemId, studentId, status, rpe, fingerPain, comment, actualSets, actualQuantity, quantityUnit, revision, supersedesId, createdAt | Histórico existente. Não há migração para as novas fórmulas, nem inferência de volume por série a partir de valores incompletos. |
| Idempotência | Requests.id, userId, key, fingerprint, entity, entityId | Reserva UUID de destino por intenção; chave única por usuário; fingerprint canônico do novo domínio; não eliminar reservas. |

## Abas novas

| Aba | Finalidade e cardinalidade |
| --- | --- |
| CAPACIDADES | Uma linha por capacidade ou manifestação. capacityId opcional aponta a capacidade atualmente associada. ID estável mesmo em futura revisão de rótulos. |
| METODOS | Uma linha por método ou protocolo; kind distingue; parentId opcional representa subclasse atual. |
| UNIDADES | Grandezas explícitas, símbolos e dimensões. Nenhuma transformação automática entre unidades. |
| INDICADORES | Indicador principal/auxiliar: relative, ordinal, undefined ou absolute. referenceType/referenceUnitsJson definem referências permitidas. |
| EXERCICIOS | Biblioteca única; principal de intensidade, principal de volume e unidades alternativas permitidas. Não possui classificação contextual. |
| EXERCICIO_CAPACIDADES | Associação N:N exerciseId/capacityId; par único. |
| EXERCICIO_METODOS | Associação N:N exerciseId/methodId; par único. Protocolos usam a mesma associação sem duplicar exercício. |
| AVALIACOES | Cada registro é uma referência individual imutável com validade explícita; supersedesId aponta outra avaliação do mesmo aluno/exercício/indicador. |
| PRESCRICOES | Revisão imutável vinculada a Workouts/Items; reúne exercício, método/protocolo, contexto, intensidade, referência e volume prescrito. |
| PRESCRICAO_SERIES | Filhos com UUID próprio; blockOrder/setOrder são ordenação lógica, nunca números de linha da planilha. |

## Campos JSON e enums

- status: active/inactive quando aplicável. Registros imutáveis não precisam de updatedAt: cada mudança histórica será nova linha/revisão com createdAt. Não há edição de registros históricos pela API.
- classification (somente PRESCRICOES): general/directed/specific, traduzidos geral/direcionado/específico.
- volumeUnitIdsJson: array de IDs permitidos, incluindo primaryVolumeUnitId, sem duplicados.
- referenceUnitsJson: array de IDs de unidade válidos para a avaliação daquele indicador.
- intensityJson: {primary, auxiliary}; cada componente conserva indicador e unidade/contexto próprio. Não há média nem substituição entre eles.
- snapshotJson: cópias de exercise, method, protocol, capacity, intensity (inclui referência completa), auxiliaryIntensities, classification e sessão (id/aluno/data).
- volumeJson: {mode:'prescribed', kind, unitId, total, lines}. mode='executed' existe somente na função de validação para a futura integração. kinds: isometric/repetitions/hand_moves/time/distance.

Entrada do volume:

| kind | unidade | Entrada e cálculo |
| --- | --- | --- |
| isometric | unit-hang-seconds | sets:[{suspensions,seconds}]; soma suspensions×seconds em cada série. |
| repetitions | unit-repetitions | sets:[{repetitions}]; soma os valores por série, sem supor igualdade. |
| hand_moves | unit-hand-moves | blocks:[{moves:[totalBoulder1,totalBoulder2,...]}]; soma todos os totais, incluindo junções/reboteios já contabilizados. |
| time | unit-seconds | sets:[{seconds}]; soma durações. |
| distance | unit-meters | sets:[{meters}]; soma distâncias. |

Cada linha de PRESCRICAO_SERIES guarda quantity, occurrences e durationSeconds. Na isometria: quantity=1, occurrences=suspensões, durationSeconds=duração; total=quantity×occurrences×durationSeconds. Demais tipos: quantity=quantidade daquela série/boulder, occurrences=1, durationSeconds vazio; total=quantity. blockOrder separa blocos de escalada; setOrder separa seus boulders ou séries. A unidade permanece explícita em cada linha.

Não há campos separados para progressões, junções ou reboteios. Nenhuma rotina soma segundos, repetições e movimentos para um volume universal. Tempo e distância da corrida são opções de configuração por prescrição; não são convertidos entre si.

## Regras e obrigatoriedade condicional

Todos os IDs fornecidos devem resolver uma entidade existente/autorizada. relative exige assessmentId e percent; ordinal exige value textual e scale; undefined exige description e proíbe percent; RPE auxiliar exige value inteiro 1–10. O indicador principal precisa coincidir com EXERCICIOS.primaryIndicatorId. RPE não se torna o principal por estar presente.

AVALIACOES exige protocolo, definição da referência, assessedOn e validUntil. Não basta informar um número ou unidade. PRESCRICOES exige expectedRevision na entrada (não é coluna): zero na primeira revisão, depois a maior revision do item. protocolId e capacityId são opcionais, mas, se fornecidos, devem estar associados ao exercício. methodId é obrigatório. Filhos são gerados pelo servidor, com UUIDs reservados no plano de gravação da prescrição.

Estrutura futura EXECUCAO_SERIES foi especificada em ARQUITETURA.md, mas não cria aba nem endpoint nesta etapa. A separação entre prescrição e execução é mantida desde agora, sem fabricar valores executados.
