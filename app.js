import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';
const GAME_CODE = 'BELGFR';
const APP_VERSION = '0.07';
const DEFAULT_PLAYERS = [
  { name: 'Eliott', initial_score: 4 },
  { name: 'Timéo', initial_score: 4 },
  { name: 'Lilouan', initial_score: 4 },
  { name: 'Damien', initial_score: 4 },
  { name: 'Amélie', initial_score: 4 },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const addPlayersContainer = document.querySelector('#add-players');
const historyList = document.querySelector('#history');
const historyEmpty = document.querySelector('#history-empty');
const statusElement = document.querySelector('#status');
const versionBadge = document.querySelector('.app__version');
const tabButtons = document.querySelectorAll('.tabs__button');
const panels = document.querySelectorAll('.panel');
const addPlayerForm = document.querySelector('#add-player-form');
const addPlayerNameInput = document.querySelector('#add-player-name');
const addPlayerInitialScoreInput = document.querySelector('#add-player-initial-score');
const addPlayerSubmit = document.querySelector('#add-player-submit');

if (versionBadge) {
  versionBadge.textContent = APP_VERSION;
  versionBadge.setAttribute('aria-label', `Version ${APP_VERSION}`);
}

let game;
let channel;
let isInitialLoad = true;

const state = {
  players: [],
  history: [],
};

function setStatus(message = '', tone = 'info') {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
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
    .select('id, name')
    .eq('game_id', gameId);

  if (error) throw error;
  if (data.length === DEFAULT_PLAYERS.length) return;

  const existingNames = new Set(data.map((player) => player.name));
  const missing = DEFAULT_PLAYERS.filter(
    (player) => !existingNames.has(player.name)
  ).map((player) => ({ ...player, game_id: gameId }));

  if (missing.length === 0) return;

  const { error: insertError } = await supabase
    .from('players')
    .insert(missing);

  if (insertError) throw insertError;
}

function sortPlayers(players) {
  const order = new Map(DEFAULT_PLAYERS.map((player, index) => [player.name, index]));
  return [...players].sort((a, b) => {
    const aOrder = order.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

function createAdditionCard(player) {
  const diff = player.score - player.initial_score;

  const card = document.createElement('article');
  card.className = 'player-line player-line--add';
  card.dataset.playerId = player.id;
  card.dataset.playerName = player.name;

  const header = document.createElement('div');
  header.className = 'player-line__header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'player-line__name';
  nameSpan.textContent = player.name;

  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'player-line__score';
  if (diff > 0) {
    scoreSpan.classList.add('player-line__score--up');
  } else if (diff < 0) {
    scoreSpan.classList.add('player-line__score--down');
  }
  scoreSpan.dataset.diff = diff;
  scoreSpan.textContent = String(player.score);

  header.append(nameSpan, scoreSpan);

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

function renderPlayers(players) {
  if (addPlayersContainer) {
    addPlayersContainer.innerHTML = '';
    players.forEach((player) => {
      addPlayersContainer.append(createAdditionCard(player));
    });
  }
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
        comment.textContent = entry.comment;
        li.append(comment);
      }

      historyList.append(li);
    });
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

  renderPlayers(state.players);
  renderHistory(state.history, state.players);

  if (!silent) {
    setStatus();
  }

  if (isInitialLoad) {
    setupTabs();
    attachAdditionEvents();
    attachHistoryEvents();
    attachPlayerCreationEvents();
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
    } catch (error) {
      console.error(error);
      setStatus("Impossible d'ajouter ce joueur.", 'error');
    } finally {
      addPlayerSubmit.disabled = false;
      addPlayerSubmit.textContent = previousText;
    }
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
