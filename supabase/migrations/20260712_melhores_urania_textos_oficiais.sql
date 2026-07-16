-- Eu Amo Urânia - textos oficiais editáveis da 1ª edição do Melhores de Urânia.
-- Migração segura: só preenche regulamento/metodologia quando os campos estão vazios.

update public.melhores_edicoes
set
  regulamento = case
    when nullif(trim(coalesce(regulamento, '')), '') is null then $regulamento$
Regulamento Oficial
Melhores de Urânia – 1ª Edição (2026)

1. Objetivo

O Melhores de Urânia é uma iniciativa realizada pelo Eu Amo Urânia com o objetivo de reconhecer, valorizar e destacar empresas, serviços e iniciativas que fazem a diferença no município de Urânia, por meio da participação da própria comunidade.

O prêmio tem caráter de reconhecimento popular, buscando incentivar a qualidade dos serviços prestados, fortalecer o comércio local e aproximar ainda mais a população dos empreendedores da cidade.

2. Organização

O prêmio é organizado e administrado pelo Eu Amo Urânia, responsável por todo o processo de indicações, homologação, votação, auditoria, apuração e divulgação dos resultados.

Todas as decisões administrativas seguem este regulamento.

3. Edição

Cada edição corresponde a um único ano.

Exemplo:

Melhores de Urânia 2026
Melhores de Urânia 2027

Cada edição possui seu próprio histórico permanente.

4. Categorias

As categorias são definidas pela organização e podem ser alteradas, ampliadas ou reduzidas em futuras edições.

Na edição inaugural serão contempladas as categorias oficiais divulgadas pela organização.

5. Indicações

Antes da abertura da votação oficial será realizado um período de indicações.

Durante esse período, qualquer pessoa poderá sugerir nomes para cada categoria.

As indicações poderão ser feitas pelos canais oficiais definidos pela organização.

O envio de uma indicação não garante a participação no prêmio.

6. Homologação dos indicados

Após o encerramento das indicações, a organização realizará uma análise das sugestões recebidas.

Serão considerados critérios como:

existência e funcionamento da empresa ou serviço;
enquadramento correto na categoria;
relevância das indicações recebidas;
cumprimento das regras deste regulamento.

Ao final da análise serão definidos até quatro indicados por categoria, que participarão da votação oficial.

A decisão da organização sobre a homologação dos indicados é definitiva.

7. Votação

A votação ocorrerá durante o período divulgado oficialmente.

Os votos serão contabilizados por dois canais:

Portal oficial do prêmio;
Enquetes oficiais do Instagram do Eu Amo Urânia.

A participação é gratuita.

O período de votação será divulgado antecipadamente.

Votos enviados após o encerramento não serão considerados.

8. Segurança

O sistema utiliza mecanismos técnicos para preservar a integridade da votação.

Poderão ser adotadas medidas como:

controle de duplicidade;
identificação técnica anônima;
validações de segurança;
registro de atividades suspeitas;
auditoria administrativa.

Votos considerados fraudulentos poderão ser desconsiderados.

9. Auditoria

Após o encerramento da votação será realizada uma conferência administrativa antes da divulgação dos vencedores.

Durante esse período poderão ocorrer:

revisão de votos;
identificação de irregularidades;
validação dos resultados.

A organização poderá invalidar votos que violem este regulamento.

10. Divulgação

Os vencedores serão divulgados exclusivamente pelos canais oficiais do Eu Amo Urânia.

Após a publicação oficial, o resultado passa a integrar permanentemente o histórico do prêmio.

11. Premiação

Os vencedores poderão receber, conforme disponibilidade da organização:

Troféu oficial;
Certificado;
Selo digital de vencedor;
Divulgação especial nos canais do Eu Amo Urânia.

Os indicados também poderão receber selo digital de participação.

12. Uso dos selos

Os selos oficiais poderão ser utilizados pelos vencedores exclusivamente para divulgação de sua conquista.

É proibida qualquer alteração na identidade visual ou utilização que induza o público a erro.

13. Alterações

A organização poderá atualizar este regulamento antes da abertura da votação, sempre que necessário para melhorar o funcionamento do prêmio.

14. Casos omissos

Situações não previstas neste regulamento serão analisadas exclusivamente pela organização do Melhores de Urânia.
$regulamento$ else regulamento end,
  metodologia = case
    when nullif(trim(coalesce(metodologia, '')), '') is null then $metodologia$
Metodologia de Apuração
Como funciona a votação

O Melhores de Urânia utiliza um modelo de votação que combina a participação da comunidade por diferentes canais oficiais.

O objetivo é tornar a apuração mais equilibrada e transparente.

1. Canais oficiais

Os votos são obtidos por meio de:

Portal oficial do Melhores de Urânia;
Enquetes oficiais realizadas no Instagram do Eu Amo Urânia.

Somente votos realizados pelos canais oficiais são considerados.

2. Peso da votação

Cada canal possui um peso definido pela organização.

Na edição inaugural:

Portal oficial: 60%
Instagram: 40%

3. Como é feito o cálculo

Os votos de cada canal são transformados em percentuais dentro da própria categoria.

Em seguida é aplicada a ponderação conforme os pesos oficiais.

Exemplo simplificado:

Portal: 60%
Instagram: 40%

O resultado final considera a participação dos dois canais, evitando que apenas um deles determine o vencedor.

4. Auditoria

Antes da divulgação oficial é realizada uma conferência administrativa para verificar:

integridade da votação;
votos duplicados;
atividades suspeitas;
inconsistências técnicas.

Caso sejam identificadas irregularidades, os votos poderão ser desconsiderados conforme o regulamento.

5. Divulgação dos resultados

Somente após a conclusão da auditoria os resultados são publicados oficialmente.

Após a publicação, eles passam a integrar o histórico permanente do prêmio.

6. Transparência

O Melhores de Urânia busca garantir um processo transparente, equilibrado e confiável.

A metodologia poderá ser aperfeiçoada nas próximas edições, sempre preservando os princípios de imparcialidade, segurança e participação da comunidade.

Organização: Eu Amo Urânia
Prêmio: Melhores de Urânia – 1ª Edição (2026)
$metodologia$ else metodologia end,
  peso_site = case when peso_site is null or peso_site = 50 then 60 else peso_site end,
  peso_instagram = case when peso_instagram is null or peso_instagram = 50 then 40 else peso_instagram end
where ano = 2026;
