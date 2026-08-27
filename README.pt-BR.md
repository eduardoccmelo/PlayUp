# PlayUp

**[Read in English](README.md)**

PlayUp é uma aplicação web para organizar partidas esportivas em grupo. Organizadores criam jogos, acompanham pagamentos e geram times equilibrados; participantes encontram seu grupo, consultam os jogos e confirmam a intenção de jogar.

> O projeto está atualmente em modo MVP e persiste os dados no navegador. Não há backend, autenticação de usuários nem sincronização entre dispositivos nesta versão.

## Índice

- [Funcionalidades](#funcionalidades)
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
- Identificador único para cada grupo, exibido na lista de grupos.
- Nome de grupo editável, com limite de 20 caracteres.
- Senha compartilhada entre organizadores para entrar no painel de administração.
- Alteração de senha mediante confirmação da senha atual.
- Exclusão de grupo mediante confirmação da senha atual.
- Separação de dados por grupo: jogadores, jogos, solicitações, pagamentos e times não se misturam entre grupos.

### Organizadores

- Criar, editar, visualizar e excluir jogos.
- Cadastro geral de jogadores do grupo.
- Edição completa dos atributos de cada jogador.
- Exclusão de um jogador do cadastro geral, com confirmação.
- Aprovação de solicitações de participação enviadas por participantes.
- Inclusão e remoção de jogadores da lista de cada jogo.
- Controle de pagamento por checkbox.
- Geração e novo balanceamento de times.
- Visualização dos pontos de balanceamento de cada jogador, exclusiva do painel administrativo.

### Participantes

- Escolha de um grupo para consultar os próximos jogos.
- Consulta da lista e dos times sem precisar se adicionar à partida.
- Confirmação de presença pesquisando o próprio nome no cadastro do grupo.
- Solicitação de participação quando o nome ainda não existe no cadastro.
- Consulta de participantes, lista de espera, pagamentos e times em modo somente leitura.
- Remoção do próprio nome da lista do jogo, sem apagar o jogador do cadastro geral.

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
- Apenas jogadores pagos entram na geração de times.
- Um jogador da lista de espera pode ser incluído manualmente na lista principal. Ele ocupa a última vaga pendente, e o jogador substituído passa para a lista de espera.

### Idiomas e interface

- Interface disponível em português e inglês.
- Idioma inicial baseado no navegador: português para navegadores em português e inglês como padrão para os demais.
- Troca manual de idioma na página inicial.
- Layout responsivo para desktop e celular.
- Logotipo PlayUp no cabeçalho; clicar nele leva à página inicial quando aplicável.

## Como usar

### Como organizador

1. Na página inicial, escolha **Sou organizador**.
2. Crie um grupo ou entre em um grupo existente com a senha compartilhada dos organizadores.
3. No painel, clique em **Novo jogo** e preencha os dados do evento.
4. Cadastre jogadores no painel **Gerenciar jogadores**.
5. Abra um jogo para adicionar jogadores à lista, editar atributos, marcar pagamentos e acompanhar a lista de espera.
6. Quando houver ao menos dois jogadores pagos, use **Gerar times**.
7. Depois da primeira geração, o mesmo botão passa a se chamar **Balancear novamente**.

### Como participante

1. Na página inicial, escolha **Vou jogar**.
2. Escolha o grupo correspondente.
3. Em cada jogo disponível, use uma das ações:
   - **Ver**: abre a lista e os times em modo leitura;
   - **Participar**: pesquisa e seleciona seu nome para entrar na lista;
   - **Solicitar participação**: envia seu nome para aprovação de um organizador.
4. Após entrar na lista, acompanhe sua situação de pagamento e os times. Se necessário, remova apenas seu nome daquele jogo.

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

O PlayUp gera dois times usando somente jogadores pagos. A composição considera pontuação, posição e velocidade, e embaralha a apresentação final dos jogadores para não expor uma hierarquia evidente.

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

- grupos não são compartilhados automaticamente com outros dispositivos;
- limpar os dados do navegador pode apagar os grupos locais;
- as senhas dos organizadores não têm proteção de servidor;
- o código de grupo ainda não permite acesso remoto por link;
- não há contas, permissões reais, recuperação de senha nem auditoria.

Para uma versão comercial, a evolução natural é adicionar uma API, banco de dados, identificadores globais de grupo, links compartilháveis e autenticação ou autorização apropriada para organizadores.

## Próximos passos sugeridos

- Backend e banco de dados para sincronizar grupos entre dispositivos.
- Link compartilhável por grupo, por exemplo `/g/<group-id>`.
- Convites de organizadores e permissões por função.
- Integração de pagamento e confirmação automática.
- Notificações por e-mail, WhatsApp ou push.
- Histórico de partidas, resultados e estatísticas.
- Mais idiomas.

## Licença

Este projeto ainda não possui uma licença definida. Antes de publicar ou aceitar contribuições externas, adicione uma licença apropriada ao repositório.
