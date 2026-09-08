# PlayUp

**[Read in English](README.md)**

PlayUp é uma aplicação web para organizar partidas esportivas em grupo. Um mesmo perfil pode gerenciar alguns grupos, participar de outros e manter uma lista própria dos próximos jogos.

> O projeto está atualmente em modo MVP. Dados, permissões e recuperação de perfil são simulados no navegador. As telas de e-mail/código de acesso são uma demonstração local (`123456`); ainda não há backend, envio real de e-mail, autenticação real nem sincronização entre dispositivos.

## Índice

- [Funcionalidades](#funcionalidades)
- [Fluxo atual do protótipo](#fluxo-atual-do-protótipo)
- [Como usar](#como-usar)
- [Regras do jogo](#regras-do-jogo)
- [Balanceamento dos times](#balanceamento-dos-times)
- [Tecnologias](#tecnologias)
- [Como executar localmente](#como-executar-localmente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Persistência e limitações atuais](#persistência-e-limitações-atuais)
- [Próximos passos sugeridos](#próximos-passos-sugeridos)

## Funcionalidades

### Grupos de jogos

- Criação de múltiplos grupos independentes.
- Cada grupo possui um código local para participantes; os dados de demonstração também incluem grupos em que o perfil atual não é admin.
- Ser admin é uma permissão por grupo, não por conta.
- Admins gerenciam jogos e jogadores; participantes veem jogos e compartilham acesso de participante.
- Um único modal de compartilhar reúne códigos de convite para jogadores e admins.
- Alteração da senha exige a senha atual.
- Separação de dados por grupo: jogadores, jogos, solicitações, pagamentos e times não se misturam entre grupos.

### Admins de grupo

- Criar, editar, visualizar e excluir jogos.
- Cadastro geral de jogadores do grupo.
- Edição completa dos atributos de cada jogador.
- Exclusão de um jogador do cadastro geral, com confirmação.
- Aprovação de solicitações de participação enviadas por participantes.
- Inclusão e remoção de jogadores da lista de cada jogo.
- Controle de pagamento por checkbox.
- Geração e novo balanceamento de times somente quando a lista principal estiver completa e todos os jogadores da lista estiverem pagos, distribuindo goleiros e outras posições de forma justa.
- Visualização dos pontos de balanceamento de cada jogador, exclusiva do painel administrativo.

### Participantes e guests

- Painel único para grupos e próximos jogos pessoais.
- Membro do grupo entra no jogo com o próprio nome, sem aprovação.
- Se o jogo estiver cheio, a entrada vai para a lista de espera.
- Quem não é membro pode adicionar um jogo por código, vê-lo em modo leitura e solicitar acesso.
- Guest só usa as ações do jogo depois da aprovação de um admin.
- Cada participante altera somente seu próprio pagamento e remove somente o próprio nome.
- Nomes não podem ser duplicados dentro de um grupo ou de uma lista ativa de jogo.

### Jogos

Cada jogo possui:

- local;
- data e dia da semana calculado automaticamente;
- horário de início;
- duração entre 45 minutos e 3 horas, em intervalos de 15 minutos;
- horário de término calculado automaticamente;
- custo da quadra e moeda (`EUR`, `USD`, `GBP` ou `BRL`);
- número máximo de jogadores;
- número da quadra opcional;
- informações de pagamento;
- aviso opcional aos participantes, com até 100 caracteres.

Os jogos são ordenados cronologicamente. Para participantes, um jogo encerrado permanece visível por até 24 horas, em estado desabilitado e somente leitura. Depois desse período, deixa de aparecer para participantes, mas continua disponível para organizadores até ser excluído manualmente.

### Listas e pagamentos

- A capacidade do jogo é definida pelo organizador.
- Quando a lista principal está cheia, novos participantes entram na lista de espera, em ordem de chegada.
- Ao remover alguém da lista principal, a primeira pessoa da espera é promovida automaticamente como pendente.
- O valor por pessoa é calculado usando somente os jogadores da lista principal; a lista de espera não altera a divisão do custo.
- Marcar um jogador como pago também o confirma para o jogo.
- Jogadores pagos ficam agrupados no topo da lista, preservando a ordem entre os já pagos.
- A geração de times fica disponível somente quando a lista principal está completa e todos os jogadores dela estão pagos.
- Um jogador da lista de espera pode ser incluído manualmente na lista principal. Ele ocupa a última vaga pendente, e o jogador substituído passa para a lista de espera.

### Idiomas e interface

- Interface disponível em português e inglês.
- Idioma inicial baseado no navegador: português para navegadores em português e inglês como padrão para os demais.
- Troca manual de idioma na página inicial.
- Layout responsivo para desktop e celular.
- Logotipo PlayUp no cabeçalho; clicar nele leva à página inicial quando aplicável.

## Fluxo atual do protótipo

1. Crie um perfil local com nome e e-mail e confirme o código de demonstração. Perfis existentes entram com e-mail e código; os dados são restaurados no mesmo navegador.
2. Em **Meus grupos**, crie/entre em grupos, gerencie aqueles em que você é admin ou veja aqueles em que é apenas participante.
3. **Meus próximos jogos** mostra apenas jogos em que seu perfil está na lista principal ou de espera.
4. Use um código de grupo para adicionar um grupo ou um código de jogo para adicionar um jogo sem entrar no grupo dele.
5. Membros entram no jogo imediatamente; guests solicitam acesso e ficam pendentes até um admin aprovar.

Os formatos temporários são validados contra os dados locais:

| Uso | Formato local |
| --- | --- |
| Participante de grupo | `PUG-<groupId>` |
| Admin de grupo | `PUA-ADMIN-<groupId>` |
| Jogo específico | `PUG-GAME-<groupId>-<gameId>` |

Esses códigos servem somente para testar a interface. Em produção, devem ser tokens aleatórios e revogáveis do servidor. Consulte a [especificação de backend](docs/backend-schema.md).

## Como usar

1. Crie, entre ou edite seu perfil local. O protótipo usa `123456` como código de acesso de demonstração.
2. Em **Meus grupos**, crie/entre em um grupo ou abra os jogos dele.
3. Se você for admin daquele grupo, use **Gerenciar** para criar jogos, manter jogadores e processar solicitações.
4. Em **Meus próximos jogos**, veja jogos em que você participa, altere seu próprio pagamento ou saia da lista.
5. Use **Tenho um código de jogo** para um jogo fora dos seus grupos. No protótipo, o código abre um jogo local; no backend, o guest solicitará aprovação.

## Regras do jogo

| Situação | Comportamento |
| --- | --- |
| Lista principal com vaga | O jogador entra como pendente de pagamento. |
| Lista principal cheia | O jogador entra na lista de espera. |
| Jogador principal removido | A primeira pessoa da espera sobe automaticamente como pendente. |
| Jogador da espera incluído manualmente | Troca com a última pessoa pendente da lista principal. |
| Jogador marcado como pago | Fica confirmado, sobe para a área de pagos e passa a ser elegível aos times. |
| Jogador removido da lista do jogo | Continua no cadastro geral do grupo. |
| Jogador excluído do cadastro geral | É removido definitivamente do grupo e das listas dos jogos. |

## Balanceamento dos times

O PlayUp gera dois times somente depois que a lista principal está completa e todos os jogadores dela estão pagos. A composição considera pontuação, posição e velocidade, e embaralha a apresentação final dos jogadores para não expor uma hierarquia evidente.

### Pontos de cada jogador

Para jogadores de linha, o nível é a base da pontuação:

| Nível | Pontos |
| --- | ---: |
| 1 | 1,00 |
| 2 | 2,00 |
| 3 | 3,00 |
| 4 | 4,00 |
| 5 | 5,00 |

Para goleiros, a escala considera a importância específica da posição:

| Nível do goleiro | Pontos |
| --- | ---: |
| 1 | 0,75 |
| 2 | 1,75 |
| 3 | 3,00 |
| 4 | 4,25 |
| 5 | 5,25 |

Os ajustes são somados à pontuação base:

| Atributo | Ajuste |
| --- | ---: |
| Velocidade rápida | +0,25 |
| Velocidade neutra | 0 |
| Velocidade lenta | -0,25 |
| Condição boa | +0,25 |
| Condição neutra | 0 |
| Condição ruim | -0,25 |

Além da soma dos pontos, o algoritmo procura distribuir goleiros, defensores, atacantes, jogadores rápidos e jogadores lentos entre as equipes. Posições neutras funcionam como coringas. Quando possível, goleiros são separados entre os dois times.

Todos os novos jogadores começam com os valores padrão: nível 3, velocidade neutra, condição neutra e posição neutra.

## Tecnologias

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- CSS nativo responsivo
- `localStorage` do navegador para persistência local

## Como executar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior
- npm 10 ou superior

### Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd playup
npm install
```

### Desenvolvimento

```bash
npm run dev
```

O Vite exibirá a URL local, normalmente `http://localhost:5173`.

### Build de produção

```bash
npm run build
npm run preview
```

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor local com recarregamento automático. |
| `npm run build` | Verifica os tipos TypeScript e cria o build de produção em `dist/`. |
| `npm run preview` | Servidor local para visualizar o build de produção. |
| `npm run lint` | Executa a análise estática do código com ESLint. |

## Estrutura do projeto

```text
src/
├── assets/                 # Logos e imagens da marca
├── components/
│   ├── LandingPage.tsx     # Página inicial e escolha de perfil
│   ├── GroupSelector.tsx   # Grupos, senha e administração de grupos
│   ├── PlayUpApp.tsx       # Estado e fluxos principais da aplicação
│   ├── GameForm.tsx        # Formulário de criar/editar jogos
│   ├── PlayerDirectoryManager.tsx
│   ├── ReadOnlyGame.tsx
│   └── Teams.tsx
├── hooks/
│   └── useLocalStorage.ts  # Persistência no navegador
├── services/
│   └── browserStorage.ts   # Funções de leitura e escrita do storage
├── utils/
│   ├── game.ts             # Datas, horários, preço e regras de visibilidade
│   └── teamBalancer.ts     # Pontuação e balanceamento de equipes
├── i18n.ts                 # Textos e traduções PT/EN
├── types.ts                # Tipos de domínio
├── App.tsx                 # Entrada da aplicação
└── App.css                 # Estilos globais e responsivos
```

## Persistência e limitações atuais

Os dados são salvos apenas no `localStorage` do navegador. Isso significa que:

- snapshots de perfil, grupos e jogos não são compartilhados automaticamente com outros dispositivos;
- limpar os dados do navegador pode apagar os grupos locais;
- as senhas dos organizadores não têm proteção de servidor;
- os códigos são validados somente contra dados locais e seedados;
- o fluxo de perfil/e-mail/código é uma simulação local: não há contas reais, envio de e-mail, recuperação de código, permissões aplicadas pelo servidor nem auditoria.

O modelo planejado de backend, permissões, API, recuperação de perfil e convites seguros está em [docs/backend-schema.md](docs/backend-schema.md).

## Próximos passos sugeridos

- Implementar o backend e banco descritos em [docs/backend-schema.md](docs/backend-schema.md).
- Recuperação de perfil por e-mail com regeneração do código de acesso.
- Links seguros e compartilháveis para grupos e jogos.
- Integração de pagamento e confirmação automática.
- Notificações por e-mail, WhatsApp ou push.
- Histórico de partidas, resultados e estatísticas.
- Mais idiomas.

## Licença

Este projeto ainda não possui uma licença definida. Antes de publicar ou aceitar contribuições externas, adicione uma licença apropriada ao repositório.
