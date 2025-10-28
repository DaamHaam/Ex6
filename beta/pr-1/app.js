import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';
const GAME_CODE = 'BELGFR';
const APP_VERSION = '0.02';
const DEFAULT_PLAYERS = [
  { name: 'Eliott', initial_score: 4 },
  { name: 'Timéo', initial_score: 4 },
  { name: 'Lilouan', initial_score: 4 },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const playersContainer = document.querySelector('#players');
const historyList = document.querySelector('#history');
const historyEmpty = document.querySelector('#history-empty');
const statusElement = document.querySelector('#status');
const undoButton = document.querySelector('#undo-button');
const versionBadge = document.querySelector('.app__version');

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

undoButton.disabled = true;

function setStatus(message = '', tone = 'info') {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
}

function formatTimestamp(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
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

function renderPlayers(players) {
  playersContainer.innerHTML = '';

  players.forEach((player) => {
    const diff = player.score - player.initial_score;
    const line = document.createElement('article');
    line.className = 'player-line';
    line.dataset.playerId = player.id;
    line.dataset.playerName = player.name;
    line.setAttribute('role', 'listitem');

    const scoreClass =
      diff > 0 ? 'player-line__score--up' : diff < 0 ? 'player-line__score--down' : '';
    const commentId = `comment-${player.id}`;

    line.innerHTML = `
      <span class="player-line__name">${player.name}</span>
      <button
        class="player-line__action"
        data-action="decrement"
        type="button"
        aria-label="Retirer un point à ${player.name}"
      >
        −
      </button>
      <span class="player-line__score ${scoreClass}" data-diff="${diff}">${player.score}</span>
      <button
        class="player-line__action"
        data-action="increment"
        type="button"
        aria-label="Ajouter un point à ${player.name}"
      >
        +
      </button>
      <button
        class="player-line__comment-toggle"
        type="button"
        aria-controls="${commentId}"
        aria-expanded="false"
        title="Commentaire optionnel"
      >
        💬
      </button>
      <div class="player-line__comment-field" id="${commentId}" hidden>
        <input
          class="comment-input"
          type="text"
          name="${commentId}"
          placeholder="Commentaire"
          autocomplete="off"
        />
      </div>
    `;

    playersContainer.append(line);
  });
}

function renderHistory(history, players) {
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
      const playerName = playerNames.get(entry.player_id) ?? 'Joueur';
      const deltaLabel = entry.delta > 0 ? '+1' : '-1';
      const deltaClass = entry.delta > 0 ? 'history__delta--up' : 'history__delta--down';
      const commentBlock = entry.comment
        ? `<p class="history__comment">${entry.comment}</p>`
        : '';

      li.innerHTML = `
        <div class="history__row">
          <span class="history__player">${playerName}</span>
          <span class="history__delta ${deltaClass}">${deltaLabel}</span>
          <time class="history__time" datetime="${entry.created_at}">
            ${formatTimestamp(entry.created_at)}
          </time>
        </div>
        ${commentBlock}
      `;

      historyList.append(li);
    });
}

function updateUndoButton(history) {
  undoButton.disabled = history.length === 0;
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
  updateUndoButton(state.history);

  if (!silent) {
    setStatus('Synchronisé.', 'success');
  }

  if (isInitialLoad) {
    attachPlayerEvents();
    isInitialLoad = false;
  }
}

async function handleDelta(playerId, delta) {
  const card = playersContainer.querySelector(`[data-player-id="${playerId}"]`);
  if (!card) return;

  const commentInput = card.querySelector('.comment-input');
  const comment = commentInput?.value.trim();
  const playerName = card.dataset.playerName ?? 'joueur';
  const buttons = card.querySelectorAll('button[data-action]');
  buttons.forEach((button) => (button.disabled = true));

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
      const commentField = card.querySelector('.player-line__comment-field');
      const toggle = card.querySelector('.player-line__comment-toggle');
      if (commentField && toggle) {
        commentField.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    }
    setStatus(`${delta > 0 ? '+1' : '-1'} ${playerName}`, 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus("Échec de l'enregistrement.", 'error');
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
}

async function undoLast() {
  undoButton.disabled = true;
  try {
    const { data: lastEntry, error: selectError } = await supabase
      .from('points')
      .select('id, player_id, delta, created_at')
      .eq('game_id', game.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    if (!lastEntry) {
      setStatus('Rien à annuler.', 'info');
      updateUndoButton(state.history);
      return;
    }

    const { error: deleteError } = await supabase
      .from('points')
      .delete()
      .eq('id', lastEntry.id);

    if (deleteError) throw deleteError;

    setStatus('Action annulée.', 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus("Échec de l'annulation.", 'error');
  } finally {
    updateUndoButton(state.history);
  }
}

function attachPlayerEvents() {
  playersContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const toggle = target.closest('.player-line__comment-toggle');
    if (toggle) {
      const card = toggle.closest('.player-line');
      if (!card) return;
      const field = card.querySelector('.player-line__comment-field');
      const input = card.querySelector('.comment-input');
      if (!field || !input) return;
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      field.hidden = expanded;
      if (!expanded) {
        input.focus();
      }
      return;
    }
    const button = target.closest('button[data-action]');
    if (!button) return;
    const container = button.closest('.player-line');
    if (!container) return;
    const playerId = container.dataset.playerId;
    if (!playerId) return;

    if (button.dataset.action === 'increment') {
      handleDelta(playerId, 1);
    } else if (button.dataset.action === 'decrement') {
      handleDelta(playerId, -1);
    }
  });

  playersContainer.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.classList.contains('comment-input')) return;
    event.preventDefault();
    const container = event.target.closest('.player-line');
    if (!container) return;
    const playerId = container.dataset.playerId;
    if (!playerId) return;
    handleDelta(playerId, 1);
  });
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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('Connecté à Supabase Realtime.', 'success');
      }
    });
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
    setStatus('Synchronisé.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Une erreur est survenue au démarrage de la partie.', 'error');
  }
}

undoButton.addEventListener('click', () => undoLast());
registerServiceWorker();
init();

window.addEventListener('beforeunload', () => {
  if (channel) {
    supabase.removeChannel(channel);
  }
});
