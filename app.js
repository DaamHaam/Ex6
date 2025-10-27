import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';
const GAME_CODE = 'BELGFR';
const DEFAULT_PLAYERS = [
  { name: 'Eliott', initial_score: 4 },
  { name: 'Timéo', initial_score: 4 },
  { name: 'Lilouan', initial_score: 4 }
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

const playersContainer = document.getElementById('players');
const historyList = document.getElementById('history');
const statusEl = document.getElementById('status');
const undoButton = document.getElementById('undo');
const loadingEl = document.getElementById('loading');
const playerTemplate = document.getElementById('player-template');
const historyTemplate = document.getElementById('history-item-template');

const state = {
  gameId: null,
  players: new Map(),
  playerOrder: [],
  playerCards: new Map(),
  history: []
};

function setStatus(message, { tone = 'info' } = {}) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setLoading(isLoading) {
  if (!loadingEl) return;
  loadingEl.hidden = !isLoading;
}

async function ensureGame() {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, code')
    .eq('code', GAME_CODE)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await supabase
    .from('games')
    .insert({ name: 'Belgique vs France', code: GAME_CODE })
    .select()
    .single();

  if (insertError) throw insertError;
  return inserted;
}

async function ensurePlayers(gameId) {
  let { data: players, error } = await supabase
    .from('players')
    .select('id, name, initial_score, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  if (!players || players.length === 0) {
    const payload = DEFAULT_PLAYERS.map((player) => ({
      ...player,
      game_id: gameId
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('players')
      .insert(payload)
      .select('id, name, initial_score, created_at')
      .order('created_at', { ascending: true });

    if (insertError) throw insertError;
    players = inserted ?? [];
  }

  return players;
}

async function fetchHistory(gameId) {
  const { data, error } = await supabase
    .from('points')
    .select('id, player_id, delta, comment, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

function buildPlayerState(players) {
  state.players.clear();
  state.playerCards.clear();
  state.playerOrder = players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map((player) => player.id);

  players.forEach((player) => {
    state.players.set(player.id, {
      id: player.id,
      name: player.name,
      initialScore: player.initial_score,
      score: player.initial_score
    });
  });
}

function applyHistoryToScores() {
  state.history.forEach((entry) => {
    const player = state.players.get(entry.player_id);
    if (!player) return;
    player.score += entry.delta;
  });
}

function createPlayerCard(player) {
  const fragment = playerTemplate.content.cloneNode(true);
  const article = fragment.querySelector('.player-card');
  const nameEl = fragment.querySelector('.player-name');
  const scoreEl = fragment.querySelector('.player-score');
  const commentEl = fragment.querySelector('.player-comment');
  const addButton = fragment.querySelector('[data-action="add"]');
  const removeButton = fragment.querySelector('[data-action="remove"]');

  article.dataset.playerId = player.id;
  nameEl.textContent = player.name;
  scoreEl.textContent = String(player.score);

  const handleAction = async (delta) => {
    const comment = commentEl.value.trim();
    setActionState(article, true);
    try {
      const playerName = player.name;
      setStatus('Envoi du point pour ' + playerName + '…');
      const { error } = await supabase.from('points').insert({
        game_id: state.gameId,
        player_id: player.id,
        delta,
        comment: comment || null
      });
      if (error) throw error;
      if (comment) {
        commentEl.value = '';
      }
      setStatus(`Point ${delta > 0 ? 'ajouté' : 'retiré'} pour ${playerName}.`, {
        tone: 'success'
      });
    } catch (err) {
      console.error(err);
      setStatus("Impossible d'enregistrer le point. Réessaie.", { tone: 'error' });
    } finally {
      setActionState(article, false);
    }
  };

  addButton.addEventListener('click', () => handleAction(1));
  removeButton.addEventListener('click', () => handleAction(-1));

  playersContainer.appendChild(fragment);
  state.playerCards.set(player.id, {
    article,
    nameEl,
    scoreEl,
    commentEl,
    addButton,
    removeButton
  });
}

function renderPlayers() {
  playersContainer.innerHTML = '';
  state.playerCards.clear();
  state.playerOrder
    .map((id) => state.players.get(id))
    .filter(Boolean)
    .forEach((player) => {
      createPlayerCard(player);
    });
}

function updatePlayerScore(playerId) {
  const data = state.players.get(playerId);
  const card = state.playerCards.get(playerId);
  if (!data || !card) return;
  card.scoreEl.textContent = String(data.score);
}

function renderHistory() {
  historyList.innerHTML = '';
  const sorted = state.history.slice().sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  sorted.forEach((entry) => {
    const player = state.players.get(entry.player_id);
    const fragment = historyTemplate.content.cloneNode(true);
    const li = fragment.querySelector('.history-item');
    const playerEl = fragment.querySelector('.history-player');
    const badgeEl = fragment.querySelector('.badge');
    const timeEl = fragment.querySelector('time');
    const commentEl = fragment.querySelector('.history-comment');

    playerEl.textContent = player ? player.name : 'Inconnu';
    badgeEl.textContent = entry.delta > 0 ? '+1' : '-1';
    badgeEl.classList.toggle('plus', entry.delta > 0);
    badgeEl.classList.toggle('minus', entry.delta < 0);

    const date = new Date(entry.created_at);
    timeEl.dateTime = date.toISOString();
    timeEl.textContent = date.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    if (entry.comment) {
      commentEl.textContent = entry.comment;
      commentEl.hidden = false;
    } else {
      commentEl.textContent = '';
      commentEl.hidden = true;
    }

    historyList.appendChild(fragment);
  });

  undoButton.disabled = state.history.length === 0;
}

function setActionState(article, pending) {
  const buttons = article.querySelectorAll('button');
  buttons.forEach((btn) => {
    btn.disabled = pending;
  });
}

async function undoLastPoint() {
  if (!state.history.length) {
    return;
  }
  const lastEntry = state.history[state.history.length - 1];
  undoButton.disabled = true;
  setStatus('Annulation du dernier point…');
  try {
    const { error } = await supabase.from('points').delete().eq('id', lastEntry.id);
    if (error) throw error;
    setStatus('Dernier point annulé.', { tone: 'success' });
  } catch (err) {
    console.error(err);
    setStatus("Impossible d'annuler le point.", { tone: 'error' });
    undoButton.disabled = false;
  }
}

function handleRealtime(payload) {
  if (!payload) return;
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT' && newRow) {
    state.history.push(newRow);
    const player = state.players.get(newRow.player_id);
    if (player) {
      player.score += newRow.delta;
      updatePlayerScore(player.id);
    }
    renderHistory();
  } else if (eventType === 'DELETE' && oldRow) {
    const idx = state.history.findIndex((item) => item.id === oldRow.id);
    if (idx !== -1) {
      state.history.splice(idx, 1);
    }
    const player = state.players.get(oldRow.player_id);
    if (player) {
      player.score -= oldRow.delta;
      updatePlayerScore(player.id);
    }
    renderHistory();
  } else if (eventType === 'UPDATE' && newRow && oldRow) {
    const idx = state.history.findIndex((item) => item.id === newRow.id);
    if (idx !== -1) {
      state.history[idx] = newRow;
    } else {
      state.history.push(newRow);
    }
    const player = state.players.get(newRow.player_id);
    const previousPlayer = state.players.get(oldRow.player_id);
    if (previousPlayer) {
      previousPlayer.score -= oldRow.delta;
      updatePlayerScore(previousPlayer.id);
    }
    if (player) {
      player.score += newRow.delta;
      updatePlayerScore(player.id);
    }
    renderHistory();
  }
}

async function bootstrap() {
  try {
    setLoading(true);
    setStatus('Initialisation en cours…');
    const game = await ensureGame();
    state.gameId = game.id;

    const players = await ensurePlayers(game.id);
    buildPlayerState(players);

    state.history = await fetchHistory(game.id);
    applyHistoryToScores();

    renderPlayers();
    renderHistory();
    setStatus('Synchronisation terminée.');
  } catch (err) {
    console.error(err);
    setStatus('Erreur lors du chargement des données.', { tone: 'error' });
  } finally {
    setLoading(false);
  }
}

function subscribeToRealtime() {
  if (!state.gameId) return;
  const channel = supabase
    .channel('public:points')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'points',
        filter: `game_id=eq.${state.gameId}`
      },
      (payload) => {
        handleRealtime(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('Connecté au temps réel.');
      }
    });

  window.addEventListener('beforeunload', () => {
    supabase.removeChannel(channel);
  });
}

undoButton.addEventListener('click', () => {
  undoLastPoint();
});

bootstrap().then(() => {
  subscribeToRealtime();
});
