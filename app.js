import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';
const GAME_CODE = 'BELGFR';
const APP_VERSION = '0.08';
const DEFAULT_INITIAL_SCORE = 0;
const DEFAULT_PLAYERS = [
  { name: 'Eliott', initial_score: DEFAULT_INITIAL_SCORE },
  { name: 'Timéo', initial_score: DEFAULT_INITIAL_SCORE },
  { name: 'Lilouan', initial_score: DEFAULT_INITIAL_SCORE },
  { name: 'Damien', initial_score: DEFAULT_INITIAL_SCORE },
  { name: 'Amélie', initial_score: DEFAULT_INITIAL_SCORE },
];
const REMOVED_PLAYER_NAMES = ['Son Goku'];
const COMMENT_ENRICHMENTS = new Map([
  [
    'chocolat',
    'Chocolat — chocolatiers de meilleure qualité, plus renommés en Belgique qu’en France',
  ],
  [
    'frites',
    'Frites — tradition de la double cuisson et friteries omniprésentes en Belgique, plus qu’en France',
  ],
  [
    'bière',
    'Bière — brasseries centenaires et styles uniques qui dépassent l’offre française en diversité',
  ],
  [
    'gaufres',
    'Gaufres — spécialité belge iconique, maîtrisée dans la rue comme en pâtisserie plus qu’en France',
  ],
  [
    'bd',
    'BD — capitale européenne de la bande dessinée avec des auteurs plus emblématiques qu’en France',
  ],
  [
    'bande dessinée',
    'BD — capitale européenne de la bande dessinée avec des auteurs plus emblématiques qu’en France',
  ],
  [
    'musique',
    'Musique — scène pop et électronique belge très innovante, plus mise en avant qu’en France',
  ],
  [
    'cyclisme',
    'Cyclisme — classiques flandriennes et culture vélo plus enracinée qu’en France',
  ],
  [
    'festivals',
    'Festivals — programmation dense en Belgique avec des événements plus reconnus qu’en France',
  ],
  [
    'football',
    'Football — génération dorée belge qui s’exporte davantage que les joueurs formés en France récemment',
  ],
  [
    'design',
    'Design — écoles et studios belges réputés, plus visibles qu’en France dans ce comparatif',
  ],
  [
    'innovation',
    'Innovation — start-ups et hubs créatifs belges en forte progression par rapport aux équivalents français',
  ],
]);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const addPlayersContainer = document.querySelector('#add-players');
const historyList = document.querySelector('#history');
const historyEmpty = document.querySelector('#history-empty');
const removePlayersList = document.querySelector('#remove-players');
const removePlayersEmpty = document.querySelector('#remove-players-empty');
const statusElement = document.querySelector('#status');
const versionBadge = document.querySelector('.app__version');
const tabButtons = document.querySelectorAll('.tabs__button');
const panels = document.querySelectorAll('.panel');
const addPlayerForm = document.querySelector('#add-player-form');
const addPlayerNameInput = document.querySelector('#add-player-name');
const addPlayerInitialScoreInput = document.querySelector('#add-player-initial-score');
const addPlayerSubmit = document.querySelector('#add-player-submit');
const addPlayerToggle = document.querySelector('#add-player-toggle');
const addPlayerDialog = document.querySelector('#add-player-dialog');
const addPlayerCloseButtons = document.querySelectorAll('[data-close-player-form]');

if (versionBadge) {
  versionBadge.textContent = APP_VERSION;
  versionBadge.setAttribute('aria-label', `Version ${APP_VERSION}`);
}

let game;
let channel;
let isInitialLoad = true;
let isPlayerFormOpen = false;

const state = {
  players: [],
  history: [],
};

function setStatus(message = '', tone = 'info') {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
}

function handlePlayerFormKeydown(event) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  closePlayerForm();
}

function handlePlayerFormPointerDown(event) {
  if (!addPlayerDialog || !addPlayerToggle) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (addPlayerDialog.contains(target) || addPlayerToggle.contains(target)) return;
  closePlayerForm({ focusToggle: false });
}

function openPlayerForm() {
  if (!addPlayerDialog || !addPlayerToggle) return;
  if (isPlayerFormOpen) return;
  addPlayerDialog.hidden = false;
  addPlayerDialog.classList.add('player-form-popover--visible');
  addPlayerToggle.setAttribute('aria-expanded', 'true');
  addPlayerToggle.classList.add('panel__action-button--active');
  isPlayerFormOpen = true;
  if (addPlayerNameInput) {
    window.setTimeout(() => {
      addPlayerNameInput.focus();
    }, 0);
  }
  document.addEventListener('keydown', handlePlayerFormKeydown);
  document.addEventListener('mousedown', handlePlayerFormPointerDown);
  document.addEventListener('touchstart', handlePlayerFormPointerDown);
}

function closePlayerForm({ focusToggle = true } = {}) {
  if (!addPlayerDialog || !addPlayerToggle) return;
  if (!isPlayerFormOpen) return;
  addPlayerDialog.classList.remove('player-form-popover--visible');
  addPlayerDialog.hidden = true;
  addPlayerToggle.setAttribute('aria-expanded', 'false');
  addPlayerToggle.classList.remove('panel__action-button--active');
  isPlayerFormOpen = false;
  document.removeEventListener('keydown', handlePlayerFormKeydown);
  document.removeEventListener('mousedown', handlePlayerFormPointerDown);
  document.removeEventListener('touchstart', handlePlayerFormPointerDown);
  if (focusToggle) {
    addPlayerToggle.focus();
  }
}

async function fetchOrCreateGame() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('code', GAME_CODE)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: createdGame, error: insertError } = await supabase
    .from('games')
    .insert({ name: 'Belgique vs France', code: GAME_CODE })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  const playersToInsert = DEFAULT_PLAYERS.map((player) => ({
    ...player,
    game_id: createdGame.id,
  }));

  const { error: playersError } = await supabase
    .from('players')
    .insert(playersToInsert);

  if (playersError) {
    throw playersError;
  }

  return createdGame;
}

async function ensurePlayersExist(gameId) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, initial_score')
    .eq('game_id', gameId);

  if (error) throw error;
  const players = Array.isArray(data) ? data : [];

  await purgeRemovedPlayers(players, gameId);
  await normalizeInitialScores(players);

  if (players.length === DEFAULT_PLAYERS.length) return;

  const existingNames = new Set(players.map((player) => player.name));
  const missing = DEFAULT_PLAYERS.filter(
    (player) => !existingNames.has(player.name)
  ).map((player) => ({ ...player, game_id: gameId }));

  if (missing.length === 0) return;

  const { error: insertError } = await supabase
    .from('players')
    .insert(missing);

  if (insertError) throw insertError;
}

async function purgeRemovedPlayers(players, gameId) {
  if (!Array.isArray(players) || players.length === 0) return;
  if (!gameId || REMOVED_PLAYER_NAMES.length === 0) return;

  const blockedNames = new Set(
    REMOVED_PLAYER_NAMES.map((name) => name.normalize('NFC').toLocaleLowerCase())
  );

  const toRemove = players.filter((player) =>
    blockedNames.has(player.name.normalize('NFC').toLocaleLowerCase())
  );

  if (toRemove.length === 0) return;

  const ids = toRemove.map((player) => player.id);

  const { error: pointsError } = await supabase
    .from('points')
    .delete()
    .eq('game_id', gameId)
    .in('player_id', ids);

  if (pointsError) throw pointsError;

  const { error: playersError } = await supabase
    .from('players')
    .delete()
    .in('id', ids);

  if (playersError) throw playersError;

  toRemove.forEach((player) => {
    const index = players.findIndex((candidate) => candidate.id === player.id);
    if (index !== -1) {
      players.splice(index, 1);
    }
  });
}

async function normalizeInitialScores(players) {
  if (!Array.isArray(players) || players.length === 0) return;

  const toNormalize = players.filter((player) => player.initial_score !== DEFAULT_INITIAL_SCORE);

  if (toNormalize.length === 0) return;

  const ids = toNormalize.map((player) => player.id);

  const { error } = await supabase
    .from('players')
    .update({ initial_score: DEFAULT_INITIAL_SCORE })
    .in('id', ids);

  if (error) throw error;

  toNormalize.forEach((player) => {
    player.initial_score = DEFAULT_INITIAL_SCORE;
  });
}

function sortPlayers(players) {
  const order = new Map(DEFAULT_PLAYERS.map((player, index) => [player.name, index]));
  return [...players].sort((a, b) => {
    const aOrder = order.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

function createAdditionCard(player, { rank, isLeader } = {}) {
  const diff = player.score - player.initial_score;

  const card = document.createElement('article');
  card.className = 'player-line player-line--add';
  card.dataset.playerId = player.id;
  card.dataset.playerName = player.name;
  if (typeof rank === 'number') {
    card.dataset.playerRank = String(rank);
  }
  if (isLeader) {
    card.classList.add('player-line--leader');
    card.dataset.leader = 'true';
  } else {
    card.dataset.leader = 'false';
  }

  const header = document.createElement('div');
  header.className = 'player-line__header';

  const identity = document.createElement('div');
  identity.className = 'player-line__identity';

  if (typeof rank === 'number') {
    const rankBadge = document.createElement('span');
    rankBadge.className = 'player-line__rank';
    rankBadge.textContent = `#${rank}`;
    identity.append(rankBadge);
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'player-line__name';
  nameSpan.textContent = player.name;

  identity.append(nameSpan);

  const scoreWrapper = document.createElement('div');
  scoreWrapper.className = 'player-line__score-wrapper';

  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'player-line__score';
  if (diff > 0) {
    scoreSpan.classList.add('player-line__score--up');
  } else if (diff < 0) {
    scoreSpan.classList.add('player-line__score--down');
  }
  scoreSpan.dataset.diff = diff;
  scoreSpan.textContent = String(player.score);

  const deltaBadge = document.createElement('span');
  deltaBadge.className = 'player-line__delta';
  if (diff > 0) {
    deltaBadge.classList.add('player-line__delta--up');
    deltaBadge.textContent = `+${diff}`;
  } else if (diff < 0) {
    deltaBadge.classList.add('player-line__delta--down');
    deltaBadge.textContent = String(diff);
  } else {
    deltaBadge.textContent = '±0';
  }

  scoreWrapper.append(scoreSpan, deltaBadge);

  header.append(identity, scoreWrapper);

  const controls = document.createElement('div');
  controls.className = 'player-line__controls';

  const commentInput = document.createElement('input');
  commentInput.className = 'comment-input';
  commentInput.type = 'text';
  commentInput.placeholder = 'Commentaire (optionnel)';
  commentInput.autocomplete = 'off';
  commentInput.setAttribute(
    'aria-label',
    `Commentaire pour ajouter un point à ${player.name}`
  );

  const actionButton = document.createElement('button');
  actionButton.className = 'player-line__action';
  actionButton.dataset.action = 'increment';
  actionButton.type = 'button';
  actionButton.textContent = '+1';
  actionButton.setAttribute('aria-label', `Ajouter un point à ${player.name}`);

  controls.append(commentInput, actionButton);
  card.append(header, controls);

  return card;
}

function renderPlayers(players, ranking) {
  if (!addPlayersContainer) return;

  addPlayersContainer.innerHTML = '';
  const ranks = ranking?.ranks ?? new Map();
  const leaders = ranking?.leaders ?? new Set();
  const topScore = ranking?.topScore ?? DEFAULT_INITIAL_SCORE;

  addPlayersContainer.dataset.topScore = String(topScore);

  players.forEach((player) => {
    addPlayersContainer.append(
      createAdditionCard(player, {
        rank: ranks.get(player.id),
        isLeader: leaders.has(player.id),
      })
    );
  });
}

function renderPlayerRemoval(players, ranking) {
  if (!removePlayersList || !removePlayersEmpty) return;

  removePlayersList.innerHTML = '';

  if (!players || players.length === 0) {
    removePlayersEmpty.hidden = false;
    return;
  }

  removePlayersEmpty.hidden = true;

  const ranks = ranking?.ranks ?? new Map();
  const leaders = ranking?.leaders ?? new Set();

  const ordered = [...players].sort((a, b) => {
    const rankA = ranks.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rankB = ranks.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });

  ordered.forEach((player) => {
    const item = document.createElement('li');
    item.className = 'remove-player';
    item.dataset.playerId = player.id;
    item.dataset.playerName = player.name;
    if (leaders.has(player.id)) {
      item.classList.add('remove-player--leader');
    }

    const content = document.createElement('div');
    content.className = 'remove-player__content';

    const identity = document.createElement('div');
    identity.className = 'remove-player__identity';

    const rankValue = ranks.get(player.id);
    if (typeof rankValue === 'number') {
      const rankBadge = document.createElement('span');
      rankBadge.className = 'remove-player__rank';
      rankBadge.textContent = `#${rankValue}`;
      identity.append(rankBadge);
    }

    const name = document.createElement('span');
    name.className = 'remove-player__name';
    name.textContent = player.name;
    identity.append(name);

    const stats = document.createElement('span');
    stats.className = 'remove-player__score';
    stats.textContent = `${player.score} pt${Math.abs(player.score) > 1 ? 's' : ''}`;

    content.append(identity, stats);

    const action = document.createElement('button');
    action.className = 'remove-player__action';
    action.type = 'button';
    action.dataset.removePlayer = 'true';
    action.textContent = 'Retirer';
    action.setAttribute('aria-label', `Retirer ${player.name} de la partie`);

    item.append(content, action);
    removePlayersList.append(item);
  });
}

function renderHistory(history, players) {
  if (!historyList || !historyEmpty) return;

  historyList.innerHTML = '';

  if (history.length === 0) {
    historyEmpty.hidden = false;
    return;
  }

  historyEmpty.hidden = true;

  const playerNames = new Map(players.map((player) => [player.id, player.name]));

  history
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'history__item';
      li.dataset.entryId = entry.id;

      const row = document.createElement('div');
      row.className = 'history__row';

      const playerName = playerNames.get(entry.player_id) ?? 'Joueur';
      const playerSpan = document.createElement('span');
      playerSpan.className = 'history__player';
      playerSpan.textContent = playerName;

      const deleteButton = document.createElement('button');
      deleteButton.className = 'history__delete';
      deleteButton.type = 'button';
      deleteButton.title = 'Supprimer';
      deleteButton.setAttribute('aria-label', `Supprimer le point de ${playerName}`);
      deleteButton.textContent = '×';

      row.append(playerSpan, deleteButton);
      li.append(row);

      if (entry.comment) {
        const comment = document.createElement('p');
        comment.className = 'history__comment';
        comment.textContent = enrichComment(entry.comment);
        li.append(comment);
      }

      historyList.append(li);
    });
}

function computeRanking(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return {
      ranks: new Map(),
      leaders: new Set(),
      topScore: DEFAULT_INITIAL_SCORE,
    };
  }

  const order = new Map(DEFAULT_PLAYERS.map((player, index) => [player.name, index]));

  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const orderA = order.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const orderB = order.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  const ranks = new Map();
  sorted.forEach((player, index) => {
    if (index === 0) {
      ranks.set(player.id, 1);
      return;
    }
    const previous = sorted[index - 1];
    const sameScore = previous.score === player.score;
    const rank = sameScore ? ranks.get(previous.id) : index + 1;
    ranks.set(player.id, rank ?? index + 1);
  });

  const topScore = sorted[0]?.score ?? DEFAULT_INITIAL_SCORE;
  const leaders = new Set(
    sorted.filter((player) => player.score === topScore).map((player) => player.id)
  );

  return { ranks, leaders, topScore };
}

function enrichComment(comment) {
  if (!comment) return '';

  const normalized = comment.normalize('NFC').trim();
  if (!normalized) return '';
  if (normalized.includes('—')) return normalized;

  const lookupKey = normalized.toLocaleLowerCase();
  const enriched = COMMENT_ENRICHMENTS.get(lookupKey);
  if (enriched) {
    return enriched;
  }

  const capitalized = normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
  return `${capitalized} — spécificité belge perçue comme plus marquée qu’en France`;
}

async function loadData({ silent = false } = {}) {
  if (!silent) {
    setStatus('Chargement…');
  }

  const [{ data: playersData, error: playersError }, { data: historyData, error: historyError }] =
    await Promise.all([
      supabase
        .from('players')
        .select('id, name, initial_score')
        .eq('game_id', game.id),
      supabase
        .from('points')
        .select('id, player_id, delta, comment, created_at')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true }),
    ]);

  if (playersError || historyError) {
    console.error(playersError ?? historyError);
    setStatus('Impossible de récupérer les données.', 'error');
    return;
  }

  const orderedPlayers = sortPlayers(playersData);
  const totals = new Map(orderedPlayers.map((player) => [player.id, player.initial_score]));

  historyData.forEach((entry) => {
    totals.set(entry.player_id, (totals.get(entry.player_id) ?? 0) + entry.delta);
  });

  state.players = orderedPlayers.map((player) => ({
    ...player,
    score: totals.get(player.id) ?? player.initial_score,
  }));
  state.history = historyData;

  const ranking = computeRanking(state.players);

  renderPlayers(state.players, ranking);
  renderPlayerRemoval(state.players, ranking);
  renderHistory(state.history, state.players);

  if (!silent) {
    setStatus();
  }

  if (isInitialLoad) {
    setupTabs();
    attachAdditionEvents();
    attachHistoryEvents();
    attachPlayerFormToggle();
    attachPlayerCreationEvents();
    attachPlayerRemovalEvents();
    isInitialLoad = false;
  }
}

async function handleDelta(playerId, delta, { commentInput, triggerButton, playerName } = {}) {
  if (!playerId || !game) return;

  const comment = commentInput?.value.trim();
  const name = playerName ?? 'joueur';

  if (triggerButton) {
    triggerButton.disabled = true;
  }

  try {
    const { error } = await supabase.from('points').insert({
      game_id: game.id,
      player_id: playerId,
      delta,
      comment: comment ? comment : null,
    });

    if (error) throw error;

    if (commentInput) {
      commentInput.value = '';
    }

    setStatus(`${delta > 0 ? '+1' : '−1'} ${name}`, 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus('Impossible de mettre à jour le score.', 'error');
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
    }
  }
}

function normalizePlayerName(name) {
  return name.normalize('NFC').trim();
}

function isDuplicatePlayer(name) {
  const normalized = normalizePlayerName(name).toLocaleLowerCase();
  return state.players.some((player) => player.name.toLocaleLowerCase() === normalized);
}

async function createPlayer({ name, initialScore }) {
  if (!game) {
    throw new Error("La partie n'est pas prête");
  }

  const { error } = await supabase.from('players').insert({
    game_id: game.id,
    name,
    initial_score: initialScore,
  });

  if (error) throw error;
}

function attachPlayerCreationEvents() {
  if (!addPlayerForm || !addPlayerNameInput || !addPlayerInitialScoreInput || !addPlayerSubmit)
    return;

  addPlayerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = normalizePlayerName(addPlayerNameInput.value);
    const initialScore = Number.parseInt(addPlayerInitialScoreInput.value, 10);

    if (!name) {
      setStatus('Renseigne un nom de joueur.', 'error');
      addPlayerNameInput.focus();
      return;
    }

    if (Number.isNaN(initialScore)) {
      setStatus('Indique un score de départ valide.', 'error');
      addPlayerInitialScoreInput.focus();
      return;
    }

    if (initialScore < 0) {
      setStatus('Le score de départ doit être positif.', 'error');
      addPlayerInitialScoreInput.focus();
      return;
    }

    if (isDuplicatePlayer(name)) {
      setStatus('Ce joueur est déjà présent.', 'error');
      addPlayerNameInput.focus();
      return;
    }

    const previousText = addPlayerSubmit.textContent;
    addPlayerSubmit.disabled = true;
    addPlayerSubmit.textContent = 'Ajout…';

    try {
      await createPlayer({ name, initialScore });
      setStatus(`${name} rejoint la partie !`, 'success');
      addPlayerForm.reset();
      addPlayerInitialScoreInput.value = addPlayerInitialScoreInput.defaultValue;
      await loadData({ silent: true });
      closePlayerForm();
    } catch (error) {
      console.error(error);
      setStatus("Impossible d'ajouter ce joueur.", 'error');
    } finally {
      addPlayerSubmit.disabled = false;
      addPlayerSubmit.textContent = previousText;
    }
  });
}

function attachPlayerFormToggle() {
  if (!addPlayerToggle || !addPlayerDialog) return;

  addPlayerToggle.addEventListener('click', () => {
    if (isPlayerFormOpen) {
      closePlayerForm({ focusToggle: false });
    } else {
      openPlayerForm();
    }
  });

  addPlayerCloseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closePlayerForm();
    });
  });
}

function attachAdditionEvents() {
  if (!addPlayersContainer) return;

  addPlayersContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('button[data-action="increment"]');
    if (!button) return;
    const card = button.closest('.player-line');
    if (!card) return;
    const playerId = card.dataset.playerId;
    if (!playerId) return;
    const commentInput = card.querySelector('.comment-input');
    handleDelta(playerId, 1, {
      commentInput,
      triggerButton: button,
      playerName: card.dataset.playerName,
    });
  });

  addPlayersContainer.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('comment-input')) return;
    event.preventDefault();
    const card = target.closest('.player-line');
    if (!card) return;
    const playerId = card.dataset.playerId;
    if (!playerId) return;
    const button = card.querySelector('button[data-action="increment"]');
    handleDelta(playerId, 1, {
      commentInput: target,
      triggerButton: button ?? undefined,
      playerName: card.dataset.playerName,
    });
  });
}

function attachHistoryEvents() {
  if (!historyList) return;

  historyList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('.history__delete');
    if (!button || button.disabled) return;
    const item = button.closest('[data-entry-id]');
    const entryId = item?.dataset.entryId;
    if (!entryId) return;
    deleteHistoryEntry(entryId);
  });

  historyList.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('history__delete') || target.disabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const item = target.closest('[data-entry-id]');
    const entryId = item?.dataset.entryId;
    if (!entryId) return;
    deleteHistoryEntry(entryId);
  });
}

async function deleteHistoryEntry(entryId) {
  if (!entryId) return;

  const item = historyList?.querySelector(`[data-entry-id="${entryId}"]`);
  const deleteButton = item?.querySelector('.history__delete');
  if (deleteButton) {
    deleteButton.disabled = true;
  }

  try {
    const { error } = await supabase.from('points').delete().eq('id', entryId);

    if (error) throw error;

    setStatus('Point retiré.', 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus('Impossible de supprimer cette entrée.', 'error');
    if (deleteButton) {
      deleteButton.disabled = false;
    }
  }
}

function attachPlayerRemovalEvents() {
  if (!removePlayersList) return;

  removePlayersList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-remove-player]');
    if (!button || button.disabled) return;
    const item = button.closest('[data-player-id]');
    const playerId = item?.dataset.playerId;
    if (!playerId) return;
    const playerName = item?.dataset.playerName ?? 'joueur';
    deletePlayer(playerId, { triggerButton: button, playerName });
  });

  removePlayersList.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.hasAttribute('data-remove-player') || target.disabled) return;
    event.preventDefault();
    const item = target.closest('[data-player-id]');
    const playerId = item?.dataset.playerId;
    if (!playerId) return;
    const playerName = item?.dataset.playerName ?? 'joueur';
    deletePlayer(playerId, { triggerButton: target, playerName });
  });
}

async function deletePlayer(playerId, { triggerButton, playerName } = {}) {
  if (!playerId || !game) return;

  let previousText;
  if (triggerButton) {
    previousText = triggerButton.textContent;
    triggerButton.disabled = true;
    triggerButton.textContent = 'Retrait…';
  }

  const name = playerName ?? 'joueur';

  try {
    const { error: pointsError } = await supabase
      .from('points')
      .delete()
      .eq('game_id', game.id)
      .eq('player_id', playerId);

    if (pointsError) throw pointsError;

    const { error: playerError } = await supabase.from('players').delete().eq('id', playerId);

    if (playerError) throw playerError;

    setStatus(`${name} retiré·e de la partie.`, 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus("Impossible de retirer ce joueur.", 'error');
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = previousText ?? 'Retirer';
    }
  }
}

function setupTabs() {
  if (tabButtons.length === 0 || panels.length === 0) return;

  const buttons = Array.from(tabButtons);
  const panelElements = Array.from(panels);

  function activate(targetPanel) {
    buttons.forEach((button) => {
      const isActive = button.dataset.panel === targetPanel;
      button.classList.toggle('tabs__button--active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panelElements.forEach((panel) => {
      const isActive = panel.dataset.panel === targetPanel;
      panel.hidden = !isActive;
      panel.classList.toggle('panel--active', isActive);
    });

    if (targetPanel !== 'add') {
      closePlayerForm({ focusToggle: false });
    }
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      activate(button.dataset.panel);
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + offset + buttons.length) % buttons.length;
      const nextButton = buttons[nextIndex];
      nextButton.focus();
      activate(nextButton.dataset.panel);
    });
  });

  const defaultButton = document.querySelector('.tabs__button--active') ?? buttons[0];
  if (defaultButton) {
    activate(defaultButton.dataset.panel);
  }
}

function registerRealtime(gameId) {
  channel = supabase
    .channel(`points-game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'points',
        filter: `game_id=eq.${gameId}`,
      },
      () => loadData({ silent: true })
    )
    .subscribe();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        if (registration.installing) {
          registration.installing.addEventListener('statechange', (event) => {
            const worker = event.target;
            if (worker && worker.state === 'installed' && registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }

        registration.update();
      })
      .catch((error) => {
        console.error('SW registration failed', error);
      });
  });
}

async function init() {
  try {
    game = await fetchOrCreateGame();
    await ensurePlayersExist(game.id);
    await loadData();
    registerRealtime(game.id);
  } catch (error) {
    console.error(error);
    setStatus('Une erreur est survenue au démarrage de la partie.', 'error');
  }
}

registerServiceWorker();
init();

window.addEventListener('beforeunload', () => {
  if (channel) {
    supabase.removeChannel(channel);
  }
});
