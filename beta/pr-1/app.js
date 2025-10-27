import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';
const GAME_CODE = 'BELGFR';
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
const installButton = document.querySelector('#install-button');

let game;
let channel;
let deferredPrompt = null;
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

function formatDelta(diff) {
  if (diff === 0) return 'Égalité avec le départ';
  return diff > 0
    ? `+${diff} depuis le départ`
    : `${diff} depuis le départ`;
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
    const card = document.createElement('article');
    card.className = 'player-card';
    card.dataset.playerId = player.id;
    card.dataset.playerName = player.name;
    card.setAttribute('role', 'listitem');

    const scoreClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';

    card.innerHTML = `
      <div class="player-card__header">
        <h3 class="player-card__name">${player.name}</h3>
        <p class="player-card__score ${scoreClass}">${player.score}</p>
      </div>
      <p class="player-card__baseline">${formatDelta(diff)}</p>
      <div class="player-card__controls">
        <div class="comment-field">
          <label for="comment-${player.id}">
            Commentaire (facultatif)
            <input
              id="comment-${player.id}"
              class="comment-input"
              type="text"
              name="comment-${player.id}"
              placeholder="Ex. Trouvé une différence"
              autocomplete="off"
            />
          </label>
        </div>
        <div class="actions">
          <button class="button button--primary" data-action="increment" type="button">
            +1
          </button>
          <button class="button button--danger" data-action="decrement" type="button">
            -1
          </button>
        </div>
      </div>
    `;

    playersContainer.append(card);
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
        </div>
        ${commentBlock}
        <time class="history__time" datetime="${entry.created_at}">
          ${formatTimestamp(entry.created_at)}
        </time>
      `;

      historyList.append(li);
    });
}

function updateUndoButton(history) {
  undoButton.disabled = history.length === 0;
}

async function loadData({ silent = false } = {}) {
  if (!silent) {
    setStatus('Chargement des scores…');
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
    setStatus('Synchronisé avec Supabase.', 'success');
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

    if (commentInput) commentInput.value = '';
    setStatus(
      `${delta > 0 ? '+1' : '-1'} pour ${playerName} enregistré.`,
      'success'
    );
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus("Impossible d'enregistrer la modification.", 'error');
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
      setStatus('Aucune action à annuler.', 'info');
      updateUndoButton(state.history);
      return;
    }

    const { error: deleteError } = await supabase
      .from('points')
      .delete()
      .eq('id', lastEntry.id);

    if (deleteError) throw deleteError;

    setStatus('Dernière action annulée.', 'success');
    await loadData({ silent: true });
  } catch (error) {
    console.error(error);
    setStatus("Impossible d'annuler la dernière action.", 'error');
  } finally {
    updateUndoButton(state.history);
  }
}

function attachPlayerEvents() {
  playersContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.player-card');
    if (!card) return;
    const playerId = card.dataset.playerId;
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
    const card = event.target.closest('.player-card');
    if (!card) return;
    const playerId = card.dataset.playerId;
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
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.error('SW registration failed', error);
      });
    });
  }
}

function setupPwaInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setStatus("Merci d'avoir installé l'application !", 'success');
    }
    deferredPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    setStatus('Application installée sur cet appareil.', 'success');
  });
}

async function init() {
  try {
    game = await fetchOrCreateGame();
    await ensurePlayersExist(game.id);
    await loadData();
    registerRealtime(game.id);
    setStatus('Prêt à compter les différences !', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Une erreur est survenue au démarrage de la partie.', 'error');
  }
}

undoButton.addEventListener('click', () => undoLast());
registerServiceWorker();
setupPwaInstallPrompt();
init();

window.addEventListener('beforeunload', () => {
  if (channel) {
    supabase.removeChannel(channel);
  }
});
