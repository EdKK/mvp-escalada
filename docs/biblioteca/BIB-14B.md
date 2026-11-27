# BIB-14B — Exercícios preventivos

Catálogo de **65 exercícios únicos** a partir das **84 ocorrências** do sumário de *Adjunct Compensatory Training for Rock Climbers*, de Schöffl, Korb e Matros (2020). A tabela usa a numeração impressa do sumário (pp. 6–7) e dos exercícios (pp. 20–33 e 41–85). Cada vínculo da tabela corresponde a uma ocorrência. [PDF original](https://www.sozialstiftung-bamberg.de/static/act-pdf/ACT-Buch_HighRes.pdf) · [Sumário em texto](https://www.readkong.com/page/act-adjunct-compensatory-training-for-rock-climbers-7853261) · [Edição com o texto dos exercícios](https://fliphtml5.com/gjivh/qqzn/ACT-Buch/)

## Critérios da correspondência

- Os nomes em português identificam a execução. Um ID com várias páginas representa o mesmo movimento e mantém todos os vínculos de origem. No catálogo, a remada nas argolas (pp. 47–48) aparece uma vez na categoria Ombros. A extensão e abertura dos dedos com elástico (pp. 25, 58, 69) aparece em cada categoria de origem.
- A extensão do punho com halter e antebraço apoiado (pp. 58 e 62) reaparece com títulos diferentes no manual. As duas descrições usam a mesma flexão dorsal com o antebraço apoiado.
- A rosca após extensão e rotação externa (pp. 22 e 43) e a rosca com descida de braço estendido (p. 52) têm trajetórias distintas. A extensão dos dedos com rotação do antebraço (p. 26) e a extensão combinada de punho e dedos (p. 66) também têm IDs próprios.
- As três ocorrências com martelo mantêm IDs separados. O manual descreve extensão do cotovelo (p. 59), rotação para dentro (p. 62) e rotação para fora com variações (p. 66).
- A elevação de kettlebell invertido das pp. 27 e 65 usa posições e ações diferentes. Na p. 27 há uma pausa com o braço estendido. Na p. 65 a execução é ajoelhada e termina com rotação do cotovelo. Variações descritas dentro de uma mesma ocorrência do sumário mantêm o vínculo dessa ocorrência.

Nos exercícios com elástico, Fraca, Média e Forte descrevem a resistência do implemento. Nos demais, os níveis indicam intensidade qualitativa. Caso o treinador use uma das variações descritas na mesma página, pode especificá-la em Orientações. O catálogo documenta a referência e a prescrição é individualizada pelo treinador.

## Distribuição

| Subgrupo | Categoria | Ocorrências | Exercícios listados na categoria |
| --- | --- | ---: | ---: |
| Gerais | Ombros | 6 | 6 |
| Gerais | Cotovelos | 2 | 2 |
| Gerais | Punhos | 1 | 1 |
| Gerais | Tronco | 3 | 3 |
| Gerais | Quadril | 1 | 1 |
| Gerais | Membros inferiores | 2 | 2 |
| Gerais | Pés | 2 | 2 |
| Específicos para lesões | Ombros | 23 | 20 |
| Específicos para lesões | Cotovelos | 14 | 12 |
| Específicos para lesões | Punhos | 4 | 4 |
| Específicos para lesões | Dedos | 2 | 2 |
| Específicos para lesões | Coluna e tronco | 12 | 12 |
| Específicos para lesões | Quadril | 7 | 7 |
| Específicos para lesões | Joelhos | 3 | 3 |
| Específicos para lesões | Tornozelos | 2 | 2 |

Há 17 ocorrências em Gerais e 67 em Específicos para lesões. Cinco ocorrências repetem um exercício na mesma categoria. As 79 entradas de categoria resultantes compartilham 65 IDs.

## Persistência e reversão

O catálogo versionado fica em `PreventiveCatalog.gs` e é consultado pela RPC autenticada da Biblioteca. A sessão integral grava o bloco `preventive` v1 no JSON da prescrição e o volume nas séries existentes. Modelos que incluem preventivos usam o JSON v3. A atualização do código inclui o novo arquivo Apps Script e os arquivos Apps Script alterados no commit. Ela dispensa inicialização, migração e alteração de planilhas.

Durante uma reversão à v30, sessões existentes continuam legíveis pela representação genérica e o feedback mantém os valores agregados, inclusive zeros e campos vazios. A v30 não dispõe do catálogo, do formulário preventivo ou da conclusão direta da BIB-13E. Para editar feedback preventivo na v30, o backend exige dor e não aceita envio de PSE para esse tipo novo de prescrição. As revisões anteriores continuam no histórico. Modelos com preventivos ficam indisponíveis para visualização e uso até restaurar o candidato, que volta a ler o JSON v3.

## Correspondência com as páginas impressas

### Gerais

| Categoria | Página | ID | Exercício |
| --- | ---: | --- | --- |
| Ombros | 20 | `prev-01` | Caminhada lateral em parada de mãos |
| Ombros | 21 | `prev-02` | Puxada diagonal de baixo para cima com elástico |
| Ombros | 22 | `prev-03` | Rosca após extensão e rotação externa do ombro |
| Ombros | 22 | `prev-04` | Abertura de peitoral sobre rolo |
| Ombros | 23 | `prev-05` | Tração na barra com elástico nos antebraços |
| Ombros | 24 | `prev-06` | Deslizamento dos antebraços na parede |
| Cotovelos | 25 | `prev-07` | Extensão e abertura dos dedos com elástico |
| Cotovelos | 26 | `prev-08` | Extensão dos dedos e do punho com rotação externa e elástico |
| Punhos | 27 | `prev-09` | Elevação de kettlebell invertido com pausa |
| Tronco | 28 | `prev-10` | Prancha com puxada unilateral de elástico |
| Tronco | 29 | `prev-11` | Escalador cruzado com bola suíça |
| Tronco | 29 | `prev-12` | Pêndulo dos joelhos com elástico nos punhos |
| Quadril | 30 | `prev-13` | Terra romeno unilateral com flexão do joelho de apoio |
| Membros inferiores | 31 | `prev-14` | Mobilização ativa dos isquiotibiais com elástico |
| Membros inferiores | 32 | `prev-15` | Agachamento unilateral sobre cadeira com espuma |
| Pés | 33 | `prev-16` | Rolamento em supinação dos tornozelos |
| Pés | 33 | `prev-17` | Bússola em apoio unilateral |

### Específicos para lesões

| Categoria | Página | ID | Exercício |
| --- | ---: | --- | --- |
| Ombros | 41 | `prev-02` | Puxada diagonal de baixo para cima com elástico |
| Ombros | 42 | `prev-18` | Extensão lateral de braço em quatro apoios |
| Ombros | 42 | `prev-19` | Tração do elástico atrás das costas |
| Ombros | 43 | `prev-03` | Rosca após extensão e rotação externa do ombro |
| Ombros | 43 | `prev-20` | Rotação externa do ombro com cotovelo elevado e elástico |
| Ombros | 44 | `prev-01` | Caminhada lateral em parada de mãos |
| Ombros | 45 | `prev-21` | Caminhada do urso com elevação de braço e variações |
| Ombros | 45 | `prev-22` | Puxada ajoelhada com elástico até a altura do pescoço |
| Ombros | 46 | `prev-23` | Flexão de braços nas argolas |
| Ombros | 46 | `prev-24` | Depressão escapular em apoio com braços estendidos |
| Ombros | 47 | `prev-25` | Remada nas argolas com elástico nos punhos |
| Ombros | 48 | `prev-25` | Remada nas argolas com elástico nos punhos |
| Ombros | 49 | `prev-22` | Puxada ajoelhada com elástico até a altura do pescoço |
| Ombros | 49 | `prev-26` | Simulação de tração com bastão em decúbito ventral |
| Ombros | 50 | `prev-27` | Desenvolvimento acima da cabeça com kettlebell |
| Ombros | 51 | `prev-20` | Rotação externa do ombro com cotovelo elevado e elástico |
| Ombros | 51 | `prev-28` | Flexão circular em parada de mãos |
| Ombros | 52 | `prev-29` | Rosca rotacional com braço estendido na descida |
| Ombros | 52 | `prev-30` | Rotação interna de ombros em decúbito ventral com halteres |
| Ombros | 53 | `prev-05` | Tração na barra com elástico nos antebraços |
| Ombros | 54 | `prev-06` | Deslizamento dos antebraços na parede |
| Ombros | 55 | `prev-31` | Estabilização escapular em decúbito ventral |
| Ombros | 55 | `prev-32` | Flexão escapular combinada |
| Cotovelos | 57 | `prev-33` | Flexão excêntrica dos dedos com elástico |
| Cotovelos | 57 | `prev-34` | Alongamento da cadeia flexora sobre bola suíça |
| Cotovelos | 58 | `prev-07` | Extensão e abertura dos dedos com elástico |
| Cotovelos | 58 | `prev-35` | Extensão do punho com halter e antebraço apoiado |
| Cotovelos | 59 | `prev-36` | Descida excêntrica do martelo com extensão do cotovelo |
| Cotovelos | 59 | `prev-37` | Flexão excêntrica dos dedos com resistência manual |
| Cotovelos | 60 | `prev-38` | Extensão excêntrica dos dedos com resistência manual |
| Cotovelos | 61 | `prev-33` | Flexão excêntrica dos dedos com elástico |
| Cotovelos | 61 | `prev-39` | Flexão de punho com halter e palma para cima |
| Cotovelos | 62 | `prev-35` | Extensão do punho com halter e antebraço apoiado |
| Cotovelos | 62 | `prev-40` | Rotação excêntrica com martelo para dentro |
| Cotovelos | 63 | `prev-41` | Trabalho excêntrico do braquial |
| Cotovelos | 64 | `prev-02` | Puxada diagonal de baixo para cima com elástico |
| Cotovelos | 64 | `prev-42` | Trabalho excêntrico do bíceps |
| Punhos | 65 | `prev-43` | Estabilização ajoelhada do punho com kettlebell invertido |
| Punhos | 66 | `prev-44` | Extensão do punho e abertura dos dedos com elástico |
| Punhos | 66 | `prev-45` | Rotação excêntrica com martelo para fora |
| Punhos | 67 | `prev-46` | Flexão de braços sobre kettlebells invertidos |
| Dedos | 69 | `prev-07` | Extensão e abertura dos dedos com elástico |
| Dedos | 69 | `prev-47` | Extensão e abertura ativa dos dedos |
| Coluna e tronco | 70 | `prev-12` | Pêndulo dos joelhos com elástico nos punhos |
| Coluna e tronco | 71 | `prev-10` | Prancha com puxada unilateral de elástico |
| Coluna e tronco | 72 | `prev-48` | Empurrar e puxar kettlebell deitado sobre rolo |
| Coluna e tronco | 73 | `prev-49` | Abertura da cintura escapular sobre bola suíça |
| Coluna e tronco | 73 | `prev-50` | Anjo no chão |
| Coluna e tronco | 74 | `prev-51` | Anjo na parede |
| Coluna e tronco | 74 | `prev-52` | Agachamento com barra acima da cabeça |
| Coluna e tronco | 75 | `prev-53` | Elevação dos cotovelos |
| Coluna e tronco | 76 | `prev-54` | Rotação em pretzel sobre bola suíça |
| Coluna e tronco | 76 | `prev-55` | Rotação em pretzel no chão |
| Coluna e tronco | 77 | `prev-56` | Pressão cervical para trás e na diagonal com elástico |
| Coluna e tronco | 77 | `prev-57` | Pressão cervical contra a mão |
| Quadril | 78 | `prev-58` | Rotação do quadril em apoio unilateral em T |
| Quadril | 79 | `prev-59` | Elevação da perna em prancha lateral |
| Quadril | 79 | `prev-60` | Agachamento em apoio unilateral em T com elástico |
| Quadril | 80 | `prev-61` | Abdução do quadril em quatro apoios |
| Quadril | 81 | `prev-14` | Mobilização ativa dos isquiotibiais com elástico |
| Quadril | 82 | `prev-62` | Alongamento dos isquiotibiais com rotação |
| Quadril | 82 | `prev-63` | Agachamento em apoio unilateral em T |
| Joelhos | 83 | `prev-13` | Terra romeno unilateral com flexão do joelho de apoio |
| Joelhos | 84 | `prev-64` | Subida unilateral no banco com carga acima da cabeça |
| Joelhos | 84 | `prev-65` | Agachamento com pé suspenso no elástico e kettlebell acima da cabeça |
| Tornozelos | 85 | `prev-16` | Rolamento em supinação dos tornozelos |
| Tornozelos | 85 | `prev-17` | Bússola em apoio unilateral |
