export type Language = "pt" | "en";
export const translations: Record<
  Exclude<Language, "pt">,
  Record<string, string>
> = {
  en: {
    Olá: "Hi",
    "SEU PERFIL": "YOUR PROFILE",
    "Como devemos chamar você?": "What should we call you?",
    "Seu nome": "Your name",
    você: "you",
    "Crie seu perfil para recuperar seus grupos e jogos em qualquer dispositivo.":
      "Create your profile to recover your groups and games on any device.",
    "E-mail": "Email",
    "Seus jogos, grupos e ferramentas de organização em um só lugar.":
      "Your games, groups, and organizer tools in one place.",
    "Gerenciar grupo": "Manage group",
    "Confirmações de": "Payment",
    "pagamento.": "confirmations.",
    "Revise os pagamentos informados pelos jogadores.":
      "Review the payments reported by players.",
    "Confirmar pagamento": "Confirm payment",
    "Marcar como lido": "Mark as read",
    "Aprovar tudo": "Approve all",
    "Dispensar tudo": "Dismiss all",
    "Defina seu perfil para participar.": "Set up your profile to join.",
    "Pagamento confirmado pelo jogador.": "Payment confirmed by the player.",
    "Pagamento desmarcado pelo jogador.": "Payment unchecked by the player.",
    "Jogo salvo": "Saved game",
    "Acesse o grupo correspondente para abrir este jogo.":
      "Open the corresponding group to access this game.",
    "Enviar código": "Send code",
    "Enviamos um código de acesso para": "We sent an access code to",
    "Código de acesso": "Access code",
    "Demonstração sem backend: use 123456.": "Backend-free demo: use 123456.",
    "Alterar dados": "Edit details",
    "Verificar código": "Verify code",
    "Enviar novo código": "Send a new code",
    "Código de acesso inválido.": "Invalid access code.",
    "Código de grupo inválido.": "Invalid group code.",
    "Código de jogo inválido.": "Invalid game code.",
    "Informe um e-mail válido.": "Enter a valid email address.",
    "Organize a próxima": "Organize your next",
    "pelada.": "match.",
    "Sou organizador →": "I'm an organizer →",
    "Vou jogar →": "I'm playing →",
    "Palavra-chave": "Passcode",
    Entrar: "Enter",
    Voltar: "Back",
    Sair: "Exit",
    JOGOS: "GAMES",
    Jogos: "Games",
    Passados: "Past",
    "Novo jogo": "New game",
    "Jogos passados": "Past games",
    passados: "past",
    "Nenhum jogo passado": "No past games",
    "Nenhum jogo futuro": "No upcoming games",
    "Convidar admin": "Invite admin",
    "Convidar admins": "Invite admins",
    "Convidar participante": "Invite participant",
    Compartilhar: "Share",
    "COMPARTILHAR GRUPO": "SHARE GROUP",
    "CONVIDAR JOGADORES": "INVITE PLAYERS",
    "CONVIDAR ADMINS": "INVITE ADMINS",
    "EDITAR GRUPO": "EDIT GROUP",
    "Nova senha (opcional)": "New passcode (optional)",
    "Senha atual (obrigatória para trocar)":
      "Current passcode (required to change it)",
    Confirmar: "Confirm",
    "Copiar código": "Copy code",
    "Código copiado.": "Code copied.",
    "Código para jogadores copiado.": "Player invite code copied.",
    "Código para admins copiado.": "Admin invite code copied.",
    "Copie este código e envie ao convidado.":
      "Copy this code and send it to the invitee.",
    "O jogo já está cheio. Deseja colocar seu nome na lista de espera?":
      "This game is already full. Do you want to add your name to the waiting list?",
    "Convidar para este jogo": "Invite to this game",
    Convidar: "Invite",
    "CONVITE DE ADMIN": "ADMIN INVITE",
    "CONVITE PARA O GRUPO": "GROUP INVITE",
    "CONVITE PARA O JOGO": "GAME INVITE",
    "Este convite pede a senha do grupo antes de liberar o acesso de admin.":
      "This invite requires the group password before granting admin access.",
    "Este convite libera a visualização dos jogos ativos do grupo.":
      "This invite grants access to view the group's active games.",
    "Este convite libera apenas este jogo para o convidado.":
      "This invite grants access only to this game.",
    "Link e código copiados nesta demonstração.": "Link and code copied in this demo.",
    "Criar jogo": "Create game",
    "Salvar alterações": "Save changes",
    "Editar detalhes do jogo": "Edit game details",
    Editar: "Edit",
    Deletar: "Delete",
    "Deletar grupo": "Delete group",
    "Excluir jogo": "Delete game",
    Excluir: "Delete",
    Cancelar: "Cancel",
    Fechar: "Close",
    "Confirmar exclusão": "Confirm deletion",
    "Esta ação não pode ser desfeita.": "This action cannot be undone.",
    "Número de jogadores": "Number of players",
    Data: "Date",
    "Dia da semana": "Weekday",
    "Horário de início": "Start time",
    "Horário de término": "End time",
    "Selecione um horário": "Select a time",
    "Selecione...": "Select...",
    "Informe uma data válida no formato DD/MM/AAAA.":
      "Enter a valid date in DD/MM/YYYY format.",
    Moeda: "Currency",
    "Informações de pagamento": "Payment details",
    "Ex.: Clube Central": "E.g. Central Club",
    "Ex.: 3": "E.g. 3",
    "Ex.: 120": "E.g. 120",
    "Ex.: 90": "E.g. 90",
    "Ex.: 12": "E.g. 12",
    "Ex.: Pix, PayPal ou conta bancária": "E.g. Pix, PayPal or bank account",
    "Ex.: Chegue 15 minutos antes": "E.g. Arrive 15 minutes early",
    Local: "Location",
    "Escolha o ": "Choose the ",
    "Escolha o": "Choose the",
    Participantes: "Participants",
    pagos: "paid",
    Participar: "Join",
    Participando: "Attending",
    Solicitar: "Request",
    "Lista de espera": "Waiting list",
    "Na lista de espera": "On waiting list",
    "A lista está vazia.": "The list is empty.",
    "Participação confirmada.": "Attendance confirmed.",
    "Seu pedido foi enviado ao organizador.":
      "Your request was sent to the organizer.",
    Quadra: "Court",
    "Quadra N/D": "Court N/A",
    "por pessoa": "per person",
    minutos: "minutes",
    "Número da quadra": "Court number",
    "Valor da quadra": "Court cost",
    "Máximo de jogadores": "Maximum players",
    Início: "Start",
    Término: "End",
    "Duração:": "Duration:",
    Horário: "Time",
    Jogadores: "Players",
    Adicionar: "Add",
    "Incluir na lista": "Include in list",
    "O jogador será incluído na última vaga pendente.":
      "The player will take the last pending spot.",
    Pendente: "Pending",
    Pago: "Paid",
    PAGAMENTO: "PAYMENT",
    "LISTA DE ESPERA": "WAITING LIST",
    "lista de espera": "waiting list",
    "Sem espera.": "No waiting list.",
    "Gerar times pagos →": "Generate paid-player teams →",
    "Gerar times": "Generate teams",
    "Balancear novamente": "Balance again",
    "Deixe o balanceamento como etapa final, de preferência no dia do jogo. Com a lista completa e todos pagos, os times são gerados automaticamente.":
      "Leave team balancing as a final step, ideally on game day. When the list is full and everyone is paid, teams are generated automatically.",
    "Rebalanceamentos manuais": "Manual rebalances",
    Balanceamentos: "Balances",
    de: "of",
    Administrador: "Administrator",
    Administrator: "Administrator",
    "Balanceamento final acionado pelo sistema.":
      "Final balance triggered by the system.",
    "O limite foi atingido. O sistema gerará os times automaticamente 15 minutos antes do jogo.":
      "The limit has been reached. The system will generate teams automatically 15 minutes before the game.",
    "Você pode participar de até 5 grupos no momento.":
      "You can belong to up to 5 groups at the moment.",
    Estatísticas: "Statistics",
    "Total de jogos": "Total games",
    "Jogos ativos": "Active games",
    "Participações por jogador": "Participations by player",
    "Times equilibrados": "Balanced teams",
    "Equipe 1": "Team 1",
    "Equipe 2": "Team 2",
    "Você vai jogar?": "Are you playing?",
    "Ver lista do jogo": "View game list",
    "ou participe": "or join",
    "Busque seu nome": "Search your name",
    "Buscar jogadores": "Search players",
    "Confirmar presença": "Confirm attendance",
    "Não encontrou seu nome?": "Can't find your name?",
    "Seu nome completo": "Your full name",
    "Solicitar participação": "Request to join",
    "Sair da lista": "Leave list",
    "Solicitar saída": "Request removal",
    "Solicitar saída da lista": "Request to leave the list",
    "Solicitações de saída": "Removal requests",
    "Solicitação de saída": "Removal request",
    "Aprovar saída": "Approve removal",
    "Aprove a saída para remover o jogador da lista do jogo.":
      "Approve the request to remove the player from the game list.",
    "Solicitação de saída enviada ao organizador.":
      "Removal request sent to the organizer.",
    "Saída confirmada.": "Removal confirmed.",
    "Deseja sair da lista deste jogo?": "Do you want to leave this game list?",
    "Deseja confirmar sua participação neste jogo?":
      "Do you want to confirm your attendance at this game?",
    "Esse jogador não está na lista deste jogo.":
      "This player is not on this game list.",
    "Já existe uma solicitação de saída para este jogador.":
      "There is already a removal request for this player.",
    "não está na lista": "is not on the list",
    "Lista do jogo": "Game list",
    "Times aguardando pagamentos": "Teams awaiting payments",
    EVENTO: "EVENT",
    "por jogador": "per player",
    jogadores: "players",
    jogos: "games",
    saída: "leave",
    pagamento: "payment",
    pontos: "points",
    "na lista": "on the list",
    "na lista de espera": "on the waiting list",
    cada: "each",
    "pagos / confirmados": "paid / confirmed",
    JOGADORES: "PLAYERS",
    ORGANIZADOR: "ORGANIZER",
    "Gerencie o": "Manage your",
    "jogo.": "game.",
    "jogos.": "games.",
    Ver: "View",
    "Crie um": "Create a",
    "Não há jogos futuros disponíveis.": "There are no upcoming games.",
    "Solicitação enviada ao organizador.": "Request sent to the organizer.",
    "Esse nome já está cadastrado ou já foi solicitado.":
      "This name is already registered or has already been requested.",
    "Esse nome já existe. Altere seu nome para continuar.":
      "This name already exists. Change your name to continue.",
    "Escolha um nome válido da busca.": "Choose a valid name from the search.",
    "Gerencie o seu": "Manage your",
    jogo: "game",
    "Jogo criado.": "Game created.",
    "Jogo atualizado.": "Game updated.",
    "Preencha todos os detalhes do jogo.": "Fill in all game details.",
    "Não é possível criar um jogo em uma data passada.":
      "You cannot create a game in the past.",
    "O horário de término deve ser posterior ao início.":
      "End time must be after start time.",
    "A duração precisa terminar no mesmo dia.":
      "The duration must end on the same day.",
    "Esse nome já está na lista.": "This name is already on the list.",
    "Já existe um grupo com esse nome.":
      "A group with this name already exists.",
    "Já existe um jogo com esses mesmos dados.":
      "A game with the same details already exists.",
    "Solicitações de participação": "Join requests",
    "Solicitações de": "Requests to",
    "saída.": "leave.",
    "Jogo não disponível": "Game unavailable",
    "Solicitação de participação": "Join request",
    Novos: "New",
    "Novos jogadores.": "New players.",
    "Aprove cada nome para incluí-lo no cadastro geral.":
      "Approve each name to add it to the player directory.",
    "Aprovar e cadastrar": "Approve and add",
    "Sair do app": "Exit app",
    "Lista principal": "Main list",
    "Sem instruções de pagamento.": "No payment instructions.",
    "Editar meu nome": "Edit my name",
    "Excluir meu nome": "Remove my name",
    "Você está na lista.": "You are on the list.",
    "Você está na lista de espera.": "You are on the waiting list.",
    "Escolha o jogo.": "Choose a game.",
    Meus: "My",
    "Meus jogos": "My games",
    "Jogos aos quais você foi convidado.": "Games you have been invited to.",
    "Estes são os jogos dos quais você está participando.":
      "These are the games you are currently attending.",
    "Tenho um código de jogo": "I have a game code",
    "Você ainda não tem jogos salvos.": "You do not have any saved games yet.",
    "Aguardando aprovação": "Waiting for approval",
    "As ações serão liberadas após a confirmação de um admin.":
      "Actions will be enabled after an admin confirms.",
    "ADICIONAR JOGO": "ADD GAME",
    "Cole o código do jogo para enviar uma solicitação ao admin.":
      "Paste the game code to send a request to the admin.",
    "Local não informado": "Location not provided",
    Real: "Brazilian real",
    Euro: "Euro",
    Dólar: "US dollar",
    "+ Novo jogo": "+ New game",
    "NOVO JOGO": "NEW GAME",
    "EDITAR JOGO": "EDIT GAME",
    "Criar novo jogo": "Create new game",
    "Nenhum jogo criado": "No games created",
    "Não existem jogos criados no momento.":
      "There are no games created at the moment.",
    "Ainda não há jogadores neste jogo.":
      "There are no players in this game yet.",
    "Ainda não há jogadores pagos.": "There are no paid players yet.",
    "São necessários pelo menos dois jogadores pagos para gerar os times.":
      "At least two paid players are needed to generate teams.",
    Nome: "Name",
    Nível: "Level",
    Velocidade: "Speed",
    Condição: "Condition",
    Posição: "Position",
    Neutra: "Neutral",
    Rápido: "Fast",
    Lento: "Slow",
    Boa: "Good",
    Ruim: "Poor",
    Goleiro: "Goalkeeper",
    Defesa: "Defense",
    Ataque: "Attack",
    Duração: "Duration",
    "Duração (min)": "Duration (min)",
    "Selecione a duração": "Select duration",
    "Pagamento: Pix, PayPal, e-mail, conta...":
      "Payment: Pix, PayPal, email, bank account...",
    "Aviso aos jogadores (opcional)": "Player notice (optional)",
    Aviso: "Notice",
    Libra: "Pound sterling",
    "Esse jogador já está na lista deste jogo.":
      "This player is already on this game list.",
    "já está na lista": "already on the list",
    min: "min",
    "€ Euro": "€ Euro",
    "Euro (€)": "Euro (€)",
    "Dólar ($)": "Dollar ($)",
    "Libra (£)": "Pound sterling (£)",
    "Real (R$)": "Brazilian real (R$)",
    "$ Dólar": "$ US Dollar",
    "£ Libra": "£ Pound Sterling",
    "R$ Real": "R$ Brazilian Real",
    Salvar: "Save",
    Cadastrar: "Register",
    "Adicionar jogador": "Add player",
    "+ Adicionar jogador": "+ Add player",
    "+ Criar jogador": "+ Create player",
    "Adicionar novo jogador": "Add new player",
    "Adicionando jogador": "Adding player",
    "Editando jogador": "Editing player",
    "Jogador adicionado com sucesso.": "Player added successfully.",
    "Jogador atualizado com sucesso.": "Player updated successfully.",
    "O nome deve ter no máximo 12 caracteres.":
      "The name can have at most 12 characters.",
    "O nome deve ter no máximo 20 caracteres.":
      "The name can have at most 20 characters.",
    "Seus grupos": "Your groups",
    "Escolha seu grupo": "Choose your group",
    "Crie ou administre seus grupos de jogos.":
      "Create or manage your game groups.",
    "Escolha o grupo para ver os próximos jogos.":
      "Choose a group to view upcoming games.",
    "Criar grupo": "Create group",
    "Entrar em um grupo": "Join a group",
    "ENTRAR EM GRUPO": "JOIN GROUP",
    "Insira o código do grupo para continuar.": "Enter the group code to continue.",
    "Acesso liberado nesta demonstração.": "Access is enabled in this demo.",
    "Você só pode criar até 3 grupos no momento.":
      "You can create up to 3 groups at the moment.",
    "Mínimo de jogadores": "Minimum players",
    "Definir o número mínimo de jogadores necessário":
      "Set the minimum number of players required",
    "Cancelamento automático": "Auto cancellation",
    Desabilitado: "Disabled",
    "O horário de cancelamento é anterior ao horário de criação do evento.":
      "The cancellation time is before the event was created.",
    hora: "hour",
    horas: "hours",
    antes: "before",
    "Balanceamento disponível para jogadores pagos":
      "Team balancing is available for paid players",
    "Balanceamento disponível apenas quando a lista estiver completa e todos os jogadores pagos.":
      "Team balancing is available only when the list is full and every player has paid.",
    Atual: "Current",
    "O balanceamento será liberado somente quando a lista estiver completa e todos os jogadores estiverem pagos.":
      "Team balancing will be available only when the list is full and every player has paid.",
    "Marque pelo menos 2 jogadores como pagos para gerar os times.":
      "Mark at least 2 players as paid to generate teams.",
    "O limite de 1 rebalanceamento foi atingido. O botão será reativado 15 minutos antes do jogo para somente mais 1 rebalanceamento final.":
      "The limit of 1 rebalance has been reached. The button will be re-enabled 15 minutes before the game for one final rebalance only.",
    "Rebalanceamento final disponível: somente 1 tentativa até o início do jogo.":
      "Final rebalance available: only 1 attempt until the game starts.",
    "O rebalanceamento final já foi utilizado.":
      "The final rebalance has already been used.",
    "Você deseja sair deste grupo?": "Do you want to leave this group?",
    "Cancelar jogo": "Cancel game",
    "Reativar jogo": "Reactivate game",
    CANCELADO: "CANCELLED",
    "NOVO GRUPO": "NEW GROUP",
    "EXCLUIR GRUPO": "DELETE GROUP",
    "Criar grupo de jogos": "Create a game group",
    "Nome do grupo": "Group name",
    "Editar nome do grupo": "Edit group name",
    "Editar grupo": "Edit group",
    "Senha dos organizadores": "Organizer passcode",
    "Código do grupo": "Group code",
    "Código do jogo": "Game code",
    Organizar: "Organize",
    "Ver jogos": "View games",
    "Sair do grupo": "Leave group",
    "SAIR DO GRUPO": "LEAVE GROUP",
    "Você deixará de ver os jogos deste grupo.": "You will no longer see this group's games.",
    "Alterar senha": "Change passcode",
    "Nova senha": "New passcode",
    "Nenhum grupo criado.": "No groups created.",
    "Nenhum jogador cadastrado.": "No players registered.",
    "Confirmar senha": "Confirm passcode",
    "Entrar como organizador": "Enter as organizer",
    "Digite a senha atual dos organizadores para continuar.":
      "Enter the current organizer passcode to continue.",
    "Dica de senha: admin": "Password hint: admin",
    "Senha atual": "Current passcode",
    "Mostrar senha": "Show passcode",
    "Ocultar senha": "Hide passcode",
    "Senha atual incorreta.": "Current passcode is incorrect.",
    Continuar: "Continue",
    "Excluir grupo": "Delete group",
    "Todos os jogos e jogadores deste grupo serão apagados.":
      "All games and players in this group will be deleted.",
    "Este jogo será excluído permanentemente.":
      "This game will be permanently deleted.",
    "Gerenciar jogadores": "Manage players",
    Gerenciar: "Manage",
    "jogadores.": "players.",
    "Deletar jogador": "Delete player",
    "Remover jogador": "Remove player",
    "Remover jogador da lista": "Remove player from the list",
    Remover: "Remove",
    "O jogador continuará cadastrado e poderá ser adicionado novamente.":
      "The player will remain registered and can be added again.",
    "foi adicionado.": "was added.",
    "foi atualizado.": "was updated.",
    "foi deletado.": "was deleted.",
    "Editar jogador": "Edit player",
    Cada: "Each",
    Pagamento: "Payment",
    neutra: "neutral",
    ruim: "poor",
    ataque: "attack",
    rapido: "fast",
    lento: "slow",
    boa: "good",
    defesa: "defense",
    goleiro: "goalkeeper",
  },
};
export function localize(value: string, language: Language) {
  return language === "pt" ? value : (translations[language][value] ?? value);
}
export function localizePage(language: Language) {
  const dictionary =
    language === "pt"
      ? Object.fromEntries(
          Object.entries(translations.en).map(([pt, en]) => [en, pt]),
        )
      : translations.en;
  const translate = (value: string) =>
    Object.entries(dictionary)
      .sort(([a], [b]) => b.length - a.length)
      .reduce((result, [from, to]) => {
        const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const expression = new RegExp(
          `(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
          "gu",
        );
        return result.replace(expression, `$1${to}`);
      }, value);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const raw = node.nodeValue ?? "";
    const translated = translate(raw);
    if (translated !== raw) node.nodeValue = translated;
  });
  document
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]")
    .forEach((element) => {
      const value = element.getAttribute("placeholder");
      if (value) element.setAttribute("placeholder", translate(value));
    });
  document.documentElement.lang = language;
}
