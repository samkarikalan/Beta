/* =========================
 
GLOBAL STATE & INITIALIZATION
 
========================= */
let selectedRow = null;
let allPlayers = [];
let players = [];
let fixedPairs = [];
let allRounds = [];
let currentRoundIndex = 0;
let schedulerState = {
  players: [],
  numCourts: 0,
  fixedPairs: [],
  restCount: new Map(),
  PlayedCount: new Map(),
  playedTogether: new Map(),
  fixedMap: new Map(),
  roundIndex: 0,
  pairPlayedSet: new Set(),
  opponentMap: new Map(), // 🆕 per-player opponent tracking
};
// Global backup object
let backupState = {
    restCount: null,
    playedTogether: null,
    pairPlayedSet: null,
    playerScoreMap: null,
    opponentMap: null
};
let isOnPage2 = false;
// Page initialization
function initPage() {
  document.getElementById("page1").style.display = 'block';
  document.getElementById("page2").style.display = 'none';
}
/* =========================
 
PLAYER MANAGEMENT
 
========================= */
function showImportModal() {
  document.getElementById('importModal').style.display = 'block';
}
function hideImportModal() {
  document.getElementById('importModal').style.display = 'none';
  document.getElementById('players-textarea').value = '';
}
/* =========================
   ADD PLAYERS FROM TEXT
========================= */
function addPlayersFromText() {
  const text = document.getElementById('players-textarea').value.trim();
  if (!text) return;
  const genderSelect = document.querySelector('input[name="genderSelect"]:checked');
  const defaultGender = genderSelect ? genderSelect.value : "Male";
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    const [nameRaw, genderRaw] = line.split(',');
    const name = nameRaw?.trim();
    const gender = genderRaw?.trim() || defaultGender;
    // Check duplicates in allPlayers
    if (name && !allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      allPlayers.push({ name, gender, active: true });
    }
  });
  players = allPlayers.filter(p => p.active);
  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();
}
/* =========================
   ADD SINGLE PLAYER
========================= */
function addPlayer() {
  const name = document.getElementById('player-name').value.trim();
  const gender = document.getElementById('player-gender').value;
  if (name && !allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    allPlayers.push({ name, gender, active: true });
    players = allPlayers.filter(p => p.active);
    updatePlayerList();
    updateFixedPairSelectors();
  } else if (name) {
    alert(`Player "${name}" already exists!`);
  }
  document.getElementById('player-name').value = '';
}
/* =========================
   EDIT PLAYER INFO
========================= */
function editPlayer(i, field, val) {
  allPlayers[i][field] = (field === 'active') ? val : val.trim();
  players = allPlayers.filter(p => p.active);
  updatePlayerList();
  updateFixedPairSelectors();
}
/* =========================
   DELETE PLAYER
========================= */
function deletePlayer(i) {
  allPlayers.splice(i, 1);
  players = allPlayers.filter(p => p.active);
  updatePlayerList();
  updateFixedPairSelectors();
}
/* =========================
   UPDATE PLAYER LIST TABLE
========================= */
function updatePlayerList() {
  const table = document.getElementById('player-list-table');
  table.innerHTML = `
    <tr>
      <th>No</th>
      <th></th>
      <th>Name</th>
      <th>P/R</th>
      <th>Del</th>
    </tr>
  `;

  allPlayers.forEach((p, i) => {
    const row = document.createElement('tr');
    if (!p.active) row.classList.add('inactive');

    row.innerHTML = `
      <!-- No. -->
      <td class="no-col" style="text-align:center; font-weight:bold;">${i + 1}</td>

      <!-- Active checkbox -->
      <td style="text-align:center;">
        <input type="checkbox" ${p.active ? 'checked' : ''} 
          onchange="editPlayer(${i}, 'active', this.checked)">
      </td>

      <!-- Name -->
      <td class="Player-cell">
        <input type="text" value="${p.name}"
           ${!p.active ? 'disabled' : ''} 
           onchange="editPlayer(${i}, 'name', this.value)">       
      </td>

      <!-- Stats: Played / Rest -->
      <td class="stat-cell">
        <span class="played-count" id="played_${i}"></span>
        <span class="rest-count" id="rest_${i}"></span>
      </td>

      <!-- Delete button -->
      <td style="text-align:center;">
        <button class="tbdelete-btn" onclick="deletePlayer(${i})">&times;</button>
      </td>
    `;

    // 🔥 Games-played circle
    const gamesElem = row.querySelector(`#games_${i}`);
    if (gamesElem) {
      const restValue = schedulerState.restCount.get(p.name) || 0;
      gamesElem.textContent = restValue;
      gamesElem.style.backgroundColor = getColorForValue(restValue);
    }

    // 🔥 Stats: Played / Rest with dynamic colors
    const playedElem = row.querySelector(`#played_${i}`);
    const restElem = row.querySelector(`#rest_${i}`);

    if (playedElem) {
      const playedValue = schedulerState.PlayedCount.get(p.name) || 0;
      playedElem.textContent = playedValue;
      playedElem.style.borderColor = getPlayedColor(playedValue);
    }

    if (restElem) {
      const restValue = schedulerState.restCount.get(p.name) || 0;
      restElem.textContent = restValue;
      restElem.style.borderColor = getRestColor(restValue);
    }

    table.appendChild(row);
  });

  enableTouchRowReorder();
}

function getPlayedColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const maxValue = 20;
  const step = 360 / maxValue;      // 360° divided by 20 numbers → 18° per step
  const hue = (Math.min(value, maxValue) - 1) * step; // subtract 1 so 1 → 0°, 2 → 18°, etc.

  return `hsl(${hue}, 70%, 55%)`;
}

function getRestColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const maxValue = 20;
  const step = 360 / maxValue;
  const hue = ((Math.min(value, maxValue) - 1) * step + 180) % 360; // offset 180° for contrast

  return `hsl(${hue}, 70%, 55%)`;
}





let selectedNoCell = null;

function enableTouchRowReorder() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach(cell => {
    cell.addEventListener("click", onNumberTouch);
    cell.addEventListener("touchend", onNumberTouch);
  });
}

function onNumberTouch(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  const sourceRow = selectedNoCell ? selectedNoCell.parentElement : null;
  const targetRow = cell.parentElement;

  // Select first row
  if (!sourceRow) {
    selectedNoCell = cell;
    cell.classList.add("selected-no");
    return;
  }

  // Unselect if same row
  if (sourceRow === targetRow) {
    selectedNoCell.classList.remove("selected-no");
    selectedNoCell = null;
    return;
  }

  const table = document.getElementById("player-list-table");

  // Move source row AFTER target row
  const nextSibling = targetRow.nextSibling;
  table.insertBefore(sourceRow, nextSibling);

  // Clear selection
  selectedNoCell.classList.remove("selected-no");
  selectedNoCell = null;

  // Update No. column
  updateNumbers();
  syncPlayersFromTable();
}


function updateNumbers() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach((cell, idx) => {
    cell.textContent = idx + 1;
  });
}

function syncPlayersFromTable() {
  const table = document.getElementById('player-list-table');
  const rows = table.querySelectorAll('tr');

  const updated = [];

  rows.forEach((row, index) => {
    if (index === 0) return; // skip header

    const nameCell = row.querySelector('.player-name');
    const genderCell = row.querySelector('.player-gender');

    if (!nameCell || !genderCell) return;

    updated.push({
      name: nameCell.textContent.trim(),
      gender: genderCell.textContent.trim(),
      active: !row.classList.contains('inactive-row')
    });
  });

  // Update your global arrays
  allPlayers = updated;
  players = allPlayers.filter(p => p.active);
}


// Function to toggle all checkboxes
function toggleAllCheckboxes(masterCheckbox) {
  // Only run if the checkbox exists and event came from it
  if (!masterCheckbox || masterCheckbox.id !== 'select-all-checkbox') return;
  const checkboxes = document.querySelectorAll('#player-list-table td:first-child input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
/* =========================
   FIXED PAIRS MANAGEMENT
========================= */
function updateFixedPairSelectors() {
  const sel1 = document.getElementById('fixed-pair-1');
  const sel2 = document.getElementById('fixed-pair-2');
  const pairedPlayers = new Set(fixedPairs.flat());
  sel1.innerHTML = '<option value="">-- Select Player 1 --</option>';
  sel2.innerHTML = '<option value="">-- Select Player 2 --</option>';
  // Only active players
  players.forEach(p => {
    if (!pairedPlayers.has(p.name)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');
      option1.value = option2.value = p.name;
      option1.textContent = option2.textContent = p.name;
      sel1.appendChild(option1);
      sel2.appendChild(option2);
    }
  });
}
function addFixedPair() {
  const p1 = document.getElementById('fixed-pair-1').value;
  const p2 = document.getElementById('fixed-pair-2').value;
  if (!p1 || !p2) {
    alert("Please select both players.");
    return;
  }
  if (p1 === p2) {
    alert("You cannot pair the same player with themselves.");
    return;
  }
  const pairKey = [p1, p2].sort().join('&');
  const alreadyExists = fixedPairs.some(pair => pair.sort().join('&') === pairKey);
  if (alreadyExists) {
    alert(`Fixed pair "${p1} & ${p2}" already exists.`);
    return;
  }
  fixedPairs.push([p1, p2]);
  const div = document.createElement('div');
  div.classList.add('fixed-pair-item');
  div.innerHTML = `
    ${p1} & ${p2}
    <span class="fixed-pair-remove" onclick="removeFixedPair(this, '${p1}', '${p2}')">
      Remove
    </span>
  `;
  document.getElementById('fixed-pair-list').appendChild(div);
  updateFixedPairSelectors();
}
function removeFixedPair(el, p1, p2) {
  fixedPairs = fixedPairs.filter(pair => !(pair[0] === p1 && pair[1] === p2));
  el.parentElement.remove();
  updateFixedPairSelectors();
}
/* =========================
 
SCHEDULER INIT & PAIR GENERATION
 
========================= */
function initScheduler(playersList, numCourts, fixedPairs = []) {
  schedulerState.players = [...playersList].reverse();
  schedulerState.numCourts = numCourts;
  schedulerState.fixedPairs = fixedPairs;
  schedulerState.restCount = new Map(playersList.map(p => [p, 0]));
 schedulerState.PlayedCount = new Map(playersList.map(p => [p, 0]));
  schedulerState.PlayerScoreMap = new Map(playersList.map(p => [p, 0]));
  schedulerState.playedTogether = new Map();
  schedulerState.fixedMap = new Map();
  schedulerState.pairPlayedSet = new Set();
  schedulerState.roundIndex = 0;
  // 🆕 Initialize opponentMap — nested map for opponent counts
  schedulerState.opponentMap = new Map();
  for (const p1 of playersList) {
    const innerMap = new Map();
    for (const p2 of playersList) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
  // Map each fixed pair for quick lookup
  fixedPairs.forEach(([a, b]) => {
    schedulerState.fixedMap.set(a, b);
    schedulerState.fixedMap.set(b, a);
  });
}
function updateScheduler(playersList) {
  schedulerState.opponentMap = new Map();
  for (const p1 of playersList) {
    const innerMap = new Map();
    for (const p2 of playersList) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function findDisjointPairs(playing, usedPairsSet, requiredPairsCount, opponentMap) {
  const allPairs = [];
  const unusedPairs = [];
  const usedPairs = [];

  // Build all pairs and classify (new vs old)
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const key = [a, b].slice().sort().join("&");
      const isNew = !usedPairsSet || !usedPairsSet.has(key);

      const pairObj = { a, b, key, isNew };
      allPairs.push(pairObj);

      if (isNew) unusedPairs.push(pairObj);
      else usedPairs.push(pairObj);
    }
  }

  // ------------------------------
  //  Opponent Freshness Score
  // ------------------------------
  function calculateOpponentFreshnessScore(currentPair, selectedPairs, opponentMap) {
    let totalScore = 0;
    const [a, b] = currentPair;

    for (const [x, y] of selectedPairs) {
      const pair1 = [x, y];
      const pair2 = [a, b];

      for (const bPlayer of pair2) {
        let newOpp = 0;
        for (const aPlayer of pair1) {
          // Your exact logic:
          if ((opponentMap.get(bPlayer)?.get(aPlayer) || 0) === 1) {
            newOpp += 1;
          }
        }
        // Your exact scoring:
        totalScore += (newOpp === 2) ? 2 : (newOpp === 1 ? 1 : 0);
      }
    }
    return totalScore;
  }

  // ------------------------------
  //  DFS Backtracking With Scoring
  // ------------------------------
  function pickBestFromCandidates(candidates) {
    const usedPlayers = new Set();
    const selected = [];
    let best = null;

    function dfs(startIndex, baseScore) {
      if (selected.length === requiredPairsCount) {
        if (!best || baseScore > best.score) {
          best = { score: baseScore, pairs: selected.slice() };
        }
        return;
      }

      for (let i = startIndex; i < candidates.length; i++) {
        const { a, b, isNew } = candidates[i];
        if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

        usedPlayers.add(a);
        usedPlayers.add(b);
        selected.push([a, b]);

        // opponent freshness score
        const oppScore = calculateOpponentFreshnessScore(
          [a, b],
          selected.slice(0, -1),
          opponentMap
        );

        // new-pair priority (100 per new pair)
        const newPairScore = isNew ? 100 : 0;

        dfs(i + 1, baseScore + newPairScore + oppScore);

        selected.pop();
        usedPlayers.delete(a);
        usedPlayers.delete(b);
      }
    }

    dfs(0, 0);
    return best ? best.pairs : null;
  }

  // -----------------------------------
  // 1) Try unused (new) pairs only
  // -----------------------------------
  if (unusedPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(unusedPairs);
    if (best) return best;
  }

  // -----------------------------------
  // 2) Try unused + used
  // -----------------------------------
  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(combined);
    if (best) return best;
  }

  // -----------------------------------
  // 3) Try all pairs as last fallback
  // -----------------------------------
  if (allPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(allPairs);
    if (best) return best;
  }

  return [];
}

function findDisjointPairs3(playing, usedPairsSet, requiredPairsCount) {
  const allPairs = [];
  const unusedPairs = [];
  const usedPairs = [];

  // 1. Generate all pairs
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const key = [a,b].slice().sort().join("&");
      const isNew = !usedPairsSet || !usedPairsSet.has(key);
      const pairObj = { a, b, key, isNew };
      allPairs.push(pairObj);
      if (isNew) unusedPairs.push(pairObj);
      else usedPairs.push(pairObj);
    }
  }

  // 2. Backtracking with newness score
  function backtrack3(candidates) {
    let bestSolution = null;
    let bestScore = -1;
    const result = [];
    const usedPlayers = new Set();

    function dfs(start, scoreSum) {
      if (result.length === requiredPairsCount) {
        if (scoreSum > bestScore) {
          bestScore = scoreSum;
          bestSolution = result.slice();
        }
        return;
      }
      for (let i = start; i < candidates.length; i++) {
        const { a, b, isNew } = candidates[i];
        if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

        usedPlayers.add(a);
        usedPlayers.add(b);
        result.push([a,b]);

        dfs(i+1, scoreSum + (isNew ? 1 : 0)); // newness score increment

        result.pop();
        usedPlayers.delete(a);
        usedPlayers.delete(b);
      }
    }

    dfs(0,0);
    return bestSolution;
  }

  // 3. Fallback logic preserved, just call backtrack on each set
  if (unusedPairs.length >= requiredPairsCount) {
    const res = backtrack(unusedPairs);
    if (res && res.length === requiredPairsCount) return res;
  }

  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const res = backtrack(combined);
    if (res && res.length === requiredPairsCount) return res;
  }

  if (allPairs.length >= requiredPairsCount) {
    const res = backtrack(allPairs);
    if (res && res.length === requiredPairsCount) return res;
  }

  return [];
}

function findDisjointPairs2(playing, usedPairsSet, requiredPairsCount) {
  const allPairs = [];
  const unusedPairs = [];
  const usedPairs = [];
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const key = [a, b].slice().sort().join("&");
      allPairs.push({ a, b, key });
      if (!usedPairsSet || !usedPairsSet.has(key)) unusedPairs.push({ a, b, key });
      else usedPairs.push({ a, b, key });
    }
  }
  function backtrack2(candidates) {
    const result = [];
    const usedPlayers = new Set();
    function dfs(start) {
      if (result.length === requiredPairsCount) return true;
      for (let i = start; i < candidates.length; i++) {
        const { a, b } = candidates[i];
        if (usedPlayers.has(a) || usedPlayers.has(b)) continue;
        usedPlayers.add(a); usedPlayers.add(b);
        result.push([a, b]);
        if (dfs(i + 1)) return true;
        result.pop();
        usedPlayers.delete(a); usedPlayers.delete(b);
      }
      return false;
    }
    return dfs(0) ? result.slice() : null;
  }
  if (unusedPairs.length >= requiredPairsCount) {
    const res = backtrack(unusedPairs);
    if (res && res.length === requiredPairsCount) return res;
  }
  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const res = backtrack(combined);
    if (res && res.length === requiredPairsCount) return res;
  }
  if (allPairs.length >= requiredPairsCount) {
    const res = backtrack(allPairs);
    if (res && res.length === requiredPairsCount) return res;
  }
  return [];
}

function AischedulerNextRound() {
  const {
    players,
    numCourts,
    fixedPairs,
    restCount,
    PlayedCount,
    playedTogether,
    fixedMap,
    pairPlayedSet,
    PlayerScoreMap,
    opponentMap,
  } = schedulerState;
  
  const totalPlayers = players.length;
const numPlayersPerRound = numCourts * 4;
let numResting = Math.max(totalPlayers - numPlayersPerRound, 0);
schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;
const roundIdx = schedulerState.roundIndex;
const totalPossiblePairs = (players.length * (players.length - 1)) / 2;

if (pairPlayedSet.size >= totalPossiblePairs) {
  pairPlayedSet.clear();
  playedTogether.clear();
}

// Separate fixed pairs and free players
const fixedPairPlayers = new Set(fixedPairs.flat());
let freePlayers = players.filter(p => !fixedPairPlayers.has(p));

let resting = [];
let playing = [];

if (fixedPairs.length > 0 && numResting >= 2) {
  // Convert fixedPairs to atomic pairs
  const fixedPairsList = fixedPairs.map(([a, b]) => [a, b]);

  // Build candidate units: fixed pairs + free players as singles
  let possiblePlayers = [
    ...fixedPairsList,
    ...freePlayers.map(p => [p])
  ];

  // Sort units by rest count (sum for pairs, individual for singles)
  possiblePlayers.sort((u1, u2) => {
    const count1 = u1.reduce((sum, p) => sum + (restCount.get(p) || 0), 0);
    const count2 = u2.reduce((sum, p) => sum + (restCount.get(p) || 0), 0);
    return count1 - count2;
  });

  // Pick resting players without splitting pairs
  for (const unit of possiblePlayers) {
    if (resting.length + unit.length <= numResting) {
      resting.push(...unit);
    }
    if (resting.length >= numResting) break;
  }

  // Select playing players
  playing = players.filter(p => !resting.includes(p)).slice(0, numPlayersPerRound);

  // Optional: keep fixed pairs together in playing
  const playingPairs = fixedPairsList.filter(([a,b]) => playing.includes(a) && playing.includes(b));
  const playingSingles = playing.filter(p => !fixedPairPlayers.has(p));
  playing = [...playingPairs.flat(), ...playingSingles];

} else {
  // No fixed pairs or resting slots < 2
  let sortedPlayers = [...players].sort((a, b) =>
    (restCount.get(a) || 0) - (restCount.get(b) || 0)
  );
  resting = sortedPlayers.slice(0, numResting);
  playing = players.filter(p => !resting.includes(p)).slice(0, numPlayersPerRound);
}

  // 5️⃣ Prepare pairs
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) fixedPairsThisRound.push([pair[0], pair[1]]);
  }
  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(p => !fixedPairPlayersThisRound.has(p));
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs = requiredPairsCount - fixedPairsThisRound.length;
  let selectedPairs = findDisjointPairs(freePlayersThisRound, pairPlayedSet, neededFreePairs, opponentMap);
  let finalFreePairs = selectedPairs;
  if (!finalFreePairs || finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set();
    finalFreePairs = [];
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;
      let chosenIdx = -1;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;
        const key = [a, b].slice().sort().join("&");
        if (!pairPlayedSet.has(key)) {
          chosenIdx = j;
          break;
        }
        if (chosenIdx === -1) chosenIdx = j;
      }
      if (chosenIdx !== -1) {
        const b = free[chosenIdx];
        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
      }
      if (finalFreePairs.length === neededFreePairs) break;
    }
    if (finalFreePairs.length < neededFreePairs) {
      const leftovers = freePlayersThisRound.filter(p => !usedPlayers.has(p));
      for (let i = 0; i + 1 < leftovers.length && finalFreePairs.length < neededFreePairs; i += 2) {
        finalFreePairs.push([leftovers[i], leftovers[i + 1]]);
      }
    }
  }
  // 6️⃣ Combine all pairs
  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  // 7️⃣ Shuffle for randomness
  allPairs = shuffle(allPairs);
  // Sort pairs by their lowest member's PlayerScoreMap
  allPairs = allPairs
    .map(pair => ({
      pair,
      score: Math.min(PlayerScoreMap.get(pair[0]) || 0, PlayerScoreMap.get(pair[1]) || 0)
    }))
    .sort((a, b) => a.score - b.score)
    .map(obj => obj.pair);
  // 🆕 8️⃣ Fair opponent balancing using opponentMap
  
  
  // Sort to prioritize pairs who faced least
  //matchupScores.sort((a, b) => a.score - b.score);
 
let matchupScores = getMatchupScores(allPairs, opponentMap);
  const games = [];
  const usedPairs = new Set();
  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join("&");
    const p2Key = pair2.join("&");
    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;
    games.push({ court: games.length + 1, pair1: [...pair1], pair2: [...pair2] });
    usedPairs.add(p1Key);
    usedPairs.add(p2Key);
    // Update opponent counts
    for (const a of pair1) {
      for (const b of pair2) {
        opponentMap.get(a).set(b, (opponentMap.get(a).get(b) || 0) + 1);
        opponentMap.get(b).set(a, (opponentMap.get(b).get(a) || 0) + 1);
      }
    }
    // 🆕 Update PlayerScoreMap
    for (const a of pair1) {
      let newOpponents = 0;
      for (const b of pair2) {
        if ((opponentMap.get(a).get(b) || 0) === 1) { // Use === 1, since opponentMap was just incremented
          newOpponents += 1;
        }
      }
      let score = (newOpponents === 2) ? 2 : (newOpponents === 1 ? 1 : 0);
      PlayerScoreMap.set(a, (PlayerScoreMap.get(a) || 0) + score);
    }
    for (const b of pair2) {
      let newOpponents = 0;
      for (const a of pair1) {
        if ((opponentMap.get(b).get(a) || 0) === 1) {
          newOpponents += 1;
        }
      }
      let score = (newOpponents === 2) ? 2 : (newOpponents === 1 ? 1 : 0);
      PlayerScoreMap.set(b, (PlayerScoreMap.get(b) || 0) + score);
    }
    if (games.length >= numCourts) break;
  }
  // 9️⃣ Track pairs played together
  for (const pr of allPairs) {
    const key = pr.slice().sort().join("&");
    pairPlayedSet.add(key);
    playedTogether.set(key, roundIdx);
  }
  // 🔟 Update resting counts
  const restingWithNumber = resting.map(p => {
    restCount.set(p, (restCount.get(p) || 0) + 1);
    return `${p}#${restCount.get(p)}`;
  });
 // 11 Update resting counts
  for (const pr of allPairs) { // pr = array of players in one pair/court
   for (const playerName of pr) { // playerName = string
     const prev = schedulerState.PlayedCount.get(playerName) || 0;
     schedulerState.PlayedCount.set(playerName, prev + 1);
   }
 }
  return {
    round: roundIdx,
    resting: restingWithNumber,
    playing,
    games,
  };
}


function getMatchupScores(allPairs, opponentMap) {
  const matchupScores = [];
  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      const [a1, a2] = allPairs[i];
      const [b1, b2] = allPairs[j];
      // --- Count past encounters for each of the 4 possible sub-matchups ---
      const ab11 = opponentMap.get(a1)?.get(b1) || 0;
      const ab12 = opponentMap.get(a1)?.get(b2) || 0;
      const ab21 = opponentMap.get(a2)?.get(b1) || 0;
      const ab22 = opponentMap.get(a2)?.get(b2) || 0;
      // --- Total previous encounters (lower = better) ---
      const totalScore = ab11 + ab12 + ab21 + ab22;
      // --- Freshness: number of unseen sub-matchups (4 = completely new) ---
      const freshness =
        (ab11 === 0 ? 1 : 0) +
        (ab12 === 0 ? 1 : 0) +
        (ab21 === 0 ? 1 : 0) +
        (ab22 === 0 ? 1 : 0);
      // --- Store individual player freshness for tie-breaker ---
      const opponentFreshness = {
        a1: (ab11 === 0 ? 1 : 0) + (ab12 === 0 ? 1 : 0),
        a2: (ab21 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
        b1: (ab11 === 0 ? 1 : 0) + (ab21 === 0 ? 1 : 0),
        b2: (ab12 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
      };
      matchupScores.push({
        pair1: allPairs[i],
        pair2: allPairs[j],
        freshness,         // 0–4
        totalScore,        // numeric repetition penalty
        opponentFreshness, // for tie-breaking only
      });
    }
  }
  // --- Sort by freshness DESC, then totalScore ASC, then opponent freshness DESC ---
  matchupScores.sort((a, b) => {
    if (b.freshness !== a.freshness) return b.freshness - a.freshness;
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    // Tie-breaker: sum of all 4 individual opponent freshness values
    const aSum = a.opponentFreshness.a1 + a.opponentFreshness.a2 + a.opponentFreshness.b1 + a.opponentFreshness.b2;
    const bSum = b.opponentFreshness.a1 + b.opponentFreshness.a2 + b.opponentFreshness.b1 + b.opponentFreshness.b2;
    return bSum - aSum; // prefer higher sum of unseen opponents
  });
  return matchupScores;
}


function getMatchupScores2(allPairs, opponentMap) {
  const matchupScores = [];
  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      const [a1, a2] = allPairs[i];
      const [b1, b2] = allPairs[j];
      // --- Count past encounters for each of the 4 possible sub-matchups ---
      const ab11 = opponentMap.get(a1)?.get(b1) || 0;
      const ab12 = opponentMap.get(a1)?.get(b2) || 0;
      const ab21 = opponentMap.get(a2)?.get(b1) || 0;
      const ab22 = opponentMap.get(a2)?.get(b2) || 0;
      // --- Total previous encounters (lower = better) ---
      const totalScore = ab11 + ab12 + ab21 + ab22;
      // --- Freshness: number of unseen sub-matchups (4 = completely new) ---
      const freshness =
        (ab11 === 0 ? 1 : 0) +
        (ab12 === 0 ? 1 : 0) +
        (ab21 === 0 ? 1 : 0) +
        (ab22 === 0 ? 1 : 0);
      matchupScores.push({
        pair1: allPairs[i],
        pair2: allPairs[j],
        freshness,   // 0–4
        totalScore,  // numeric repetition penalty
      });
    }
  }
  // --- Sort by freshness DESC (prefer new opponents), then by totalScore ASC ---
  matchupScores.sort((a, b) => {
    if (b.freshness !== a.freshness) return b.freshness - a.freshness;
    return a.totalScore - b.totalScore;
  });
  return matchupScores;
}

/* =========================
 
DISPLAY & UI FUNCTIONS
 
========================= */
// Main round display

function clearPreviousRound() {
  const resultsDiv = document.getElementById('game-results');

  // Remove all child nodes (old rounds)
  while (resultsDiv.firstChild) {
    resultsDiv.removeChild(resultsDiv.firstChild);
  }

  // Remove any lingering selection highlights
  window.selectedPlayer = null;
  window.selectedTeam = null;
  document.querySelectorAll('.selected, .selected-team, .swapping').forEach(el => {
    el.classList.remove('selected', 'selected-team', 'swapping');
  });
}

function showRound(index) {
  clearPreviousRound();
 const resultsDiv = document.getElementById('game-results');
  resultsDiv.innerHTML = '';
  const data = allRounds[index];
  if (!data) return;
  // ✅ Update round title
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "round-title";
  roundTitle.innerText = data.round;
  // ✅ Create sections safely
  let restDiv = null;
  if (data.resting && data.resting.length !== 0) {
    restDiv = renderRestingPlayers(data, index);
  }
  const gamesDiv = renderGames(data, index);
  // ✅ Wrap everything in a container to distinguish latest vs played
  const wrapper = document.createElement('div');
  const isLatest = index === allRounds.length - 1;
  wrapper.className = isLatest ? 'latest-round' : 'played-round';
  // ✅ Append conditionally
  if (restDiv) {
    wrapper.append(restDiv, gamesDiv);
  } else {
    wrapper.append(gamesDiv);
  }
  resultsDiv.append(wrapper);
  // ✅ Navigation buttons
  document.getElementById('prevBtn').disabled = index === 0;
  document.getElementById('nextBtn').disabled = false;
}
// Resting players display
function renderRestingPlayers(data, index) {
  const restDiv = document.createElement('div');
  restDiv.className = 'round-header';
  const title = document.createElement('div');
  title.innerText = 'Resting:';
  restDiv.appendChild(title);
  const restBox = document.createElement('div');
  restBox.className = 'rest-box';
  if (data.resting.length === 0) {
    const span = document.createElement('span');
    span.innerText = 'None';
    restBox.appendChild(span);
  } else {
    data.resting.forEach(player => {
      restBox.appendChild(makeRestButton(player, data, index));
    });
  }
  restDiv.appendChild(restBox);
  return restDiv;
}
function renderGames(data, index) {
  const wrapper = document.createElement('div');
  data.games.forEach((game, gameIndex) => {
    // 🟦 Create the main container for the match
    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';
    // Helper → Team letters (A, B, C, D...)
    const getTeamLetter = (gameIndex, teamSide) => {
      const teamNumber = gameIndex * 2 + (teamSide === 'L' ? 0 : 1);
      return String.fromCharCode(65 + teamNumber);
    };
    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;
      // 🔁 Swap icon
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);
      // 👥 Add player buttons
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(makePlayerButton(p, teamSide, gameIndex, i, data, index));
      });
      // ✅ Swap logic (only for latest round)
      const isLatestRound = index === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (window.selectedTeam) {
            const src = window.selectedTeam;
            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(src, { teamSide, gameIndex }, data, index);
            }
            window.selectedTeam = null;
            document
              .querySelectorAll('.selected-team')
              .forEach(b => b.classList.remove('selected-team'));
          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }
      return teamDiv;
    };
    // 🟢 Create left & right sides
    const team1 = makeTeamDiv('L');
    const team2 = makeTeamDiv('R');
    // ⚪ VS label
    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = 'VS';
    // Add everything to container
    teamsDiv.append(team1, vs, team2);
    wrapper.appendChild(teamsDiv);
  });
  return wrapper;
}
// Games display
function renderGames2(data, index) {
  const wrapper = document.createElement('div');
  data.games.forEach((game, gameIndex) => {
    const card = document.createElement('div');
    card.className = 'match-card';
    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';
    // Helper → Team letters (A, B, C, D...)
    const getTeamLetter = (gameIndex, teamSide) => {
      const teamNumber = gameIndex * 2 + (teamSide === 'L' ? 0 : 1);
      return String.fromCharCode(65 + teamNumber);
    };
    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;
      // 🟢 Exchange icon button
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁'; // you can replace with ↔️ or ⟳
      teamDiv.appendChild(swapIcon);
      // 🎾 Add player buttons
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(makePlayerButton(p, teamSide, gameIndex, i, data, index));
      });
      // 🟦 Team swapping only for latest round
      const isLatestRound = index === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation(); // prevent bubbling
          e.preventDefault();
          // ✅ Swap logic
          if (window.selectedTeam) {
            const src = window.selectedTeam;
            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(src, { teamSide, gameIndex }, data, index);
            }
            window.selectedTeam = null;
            document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }
      return teamDiv;
    };
    const team1 = makeTeamDiv('L');
    const team2 = makeTeamDiv('R');
    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = 'VS';
    teamsDiv.append(team1, vs, team2);
    card.appendChild(teamsDiv);
    wrapper.appendChild(card);
  });
  return wrapper;
}
function makePlayerButton(name, teamSide, gameIndex, playerIndex, data, index) {
  const btn = document.createElement('button');
  btn.className = teamSide === 'L' ? 'Lplayer-btn' : 'Rplayer-btn';
  btn.innerText = name;
  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn; // not interactive if not latest
  // ✅ Click/tap to select or swap (no long press)
  const handleTap = (e) => {
    e.preventDefault();
    // If another player already selected → swap between teams
    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'rest') {
        // Coming from rest list → move into team
        handleDropRestToTeam(e, teamSide, gameIndex, playerIndex, data, index, src.playerName);
      } else {
        // Swap between team slots
        handleDropBetweenTeams(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src
        );
      }
      // Clear selection
      window.selectedPlayer = null;
      document.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
    } else {
      // Select this player for swap
      window.selectedPlayer = {
        playerName: name,
        teamSide,
        gameIndex,
        playerIndex,
        from: 'team'
      };
      btn.classList.add('selected');
    }
  };
  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);
  return btn;
}
function makeRestButton(player, data, index) {
  const btn = document.createElement('button');
  btn.innerText = player;
  btn.className = 'rest-btn';
  // 🎨 Color by player number
  const match = player.match(/\.?#(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    const hue = (num * 40) % 360;
    btn.style.backgroundColor = `hsl(${hue}, 65%, 45%)`;
  } else {
    btn.style.backgroundColor = '#777';
  }
  btn.style.color = 'white';
  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn; // not interactive if not latest
  // ✅ Tap-to-move between Rest ↔ Team
  const handleTap = (e) => {
    e.preventDefault();
    // If a team player selected → move from rest to team
    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'team') {
        handleDropRestToTeam(e, src.teamSide, src.gameIndex, src.playerIndex, data, index, player);
      }
      window.selectedPlayer = null;
      document.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
    } else {
      // Select this resting player
      window.selectedPlayer = { playerName: player, from: 'rest' };
      btn.classList.add('selected');
    }
  };
  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);
  return btn;
}
function makeTeamButton(label, teamSide, gameIndex, data, index) {
  const btn = document.createElement('button');
  btn.className = 'team-btn';
  btn.innerText = label; // Visible label stays simple (Team L / Team R)
  // Store internal unique info in dataset
  btn.dataset.gameIndex = gameIndex;
  btn.dataset.teamSide = teamSide;
  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.selectedTeam) {
      const src = window.selectedTeam;
      if (src.gameIndex !== gameIndex) {
        handleTeamSwapAcrossCourts(src, { teamSide, gameIndex }, data, index);
      }
      window.selectedTeam = null;
      document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
    } else {
      // Store internal info for selection
      window.selectedTeam = { teamSide, gameIndex };
      btn.classList.add('selected-team');
    }
  });
  return btn;
}
function handleDropRestToTeam(e, teamSide, gameIndex, playerIndex, data, index, movingPlayer = null) {
  // ✅ For desktop drag
  const drop = !movingPlayer && e.dataTransfer
    ? JSON.parse(e.dataTransfer.getData('text/plain'))
    : { type: 'rest', player: movingPlayer };
  if (drop.type !== 'rest' || !drop.player) return;
  const teamKey = teamSide === 'L' ? 'pair1' : 'pair2';
  const restIndex = data.resting.indexOf(drop.player);
  if (restIndex === -1) return;

  const baseNewPlayer = drop.player.replace(/#\d+$/, '');
  const oldPlayer = data.games[gameIndex][teamKey][playerIndex];

  data.games[gameIndex][teamKey][playerIndex] = baseNewPlayer;

  const { restCount } = schedulerState;

  // ✅ Update PlayedCount map if not already initialized
  if (!schedulerState.PlayedCount) {
    schedulerState.PlayedCount = new Map(allPlayers.map(p => [p.name, 0]));
  }

  // ✅ Update PlayedCount
  if (oldPlayer && oldPlayer !== '(Empty)') {
    const cleanOld = oldPlayer.replace(/#\d+$/, '');

    // Increment old player's rest (existing logic)
    const newCount = (restCount.get(cleanOld) || 0) + 1;
    restCount.set(cleanOld, newCount);
    data.resting[restIndex] = `${cleanOld}#${newCount}`;

    // ✅ Decrement PlayedCount for old player
    const prevPlayed = schedulerState.PlayedCount.get(cleanOld) || 0;
    schedulerState.PlayedCount.set(cleanOld, Math.max(prevPlayed - 1, 0));

  } else {
    data.resting[restIndex] = null;
  }

  // ✅ Update new player's rest count (existing logic)
  restCount.set(baseNewPlayer, Math.max((restCount.get(baseNewPlayer) || 0) - 1, 0));

  // ✅ Increment PlayedCount for the new player
  const prevPlayedNew = schedulerState.PlayedCount.get(baseNewPlayer) || 0;
  schedulerState.PlayedCount.set(baseNewPlayer, prevPlayedNew + 1);

  data.resting = data.resting.filter(p => p && p !== '(Empty)');
  showRound(index);
}

function handleDropBetweenTeams(e, teamSide, gameIndex, playerIndex, data, index, src) {
  // src contains info about the player you selected first
  const { teamSide: fromTeamSide, gameIndex: fromGameIndex, playerIndex: fromPlayerIndex, playerName: player } = src;
  if (!player || player === '(Empty)') return;
  const fromTeamKey = fromTeamSide === 'L' ? 'pair1' : 'pair2';
  const toTeamKey = teamSide === 'L' ? 'pair1' : 'pair2';
  const fromTeam = data.games[fromGameIndex][fromTeamKey];
  const toTeam = data.games[gameIndex][toTeamKey];
  // No need to strip #index anymore
  const movedPlayer = player;
  const targetPlayer = toTeam[playerIndex];
  // ✅ Swap players
  toTeam[playerIndex] = movedPlayer;
  fromTeam[fromPlayerIndex] = targetPlayer && targetPlayer !== '(Empty)' ? targetPlayer : '(Empty)';
  showRound(index);
}

// Add a global flag to prevent concurrent swaps
let swapInProgress = false;
const swapQueue = [];

function handleTeamSwapAcrossCourts(src, target, data, index) {
  if (!src || !target) return;
  if (src.gameIndex === target.gameIndex && src.teamSide === target.teamSide) return;

  // Queue the swap if another is in progress
  if (swapInProgress) {
    swapQueue.push({ src, target, data, index });
    return;
  }

  swapInProgress = true;

  const srcKey = src.teamSide === 'L' ? 'pair1' : 'pair2';
  const targetKey = target.teamSide === 'L' ? 'pair1' : 'pair2';

  // Fetch teams immediately before swapping
  const srcTeam = data.games[src.gameIndex][srcKey];
  const targetTeam = data.games[target.gameIndex][targetKey];

  // Animation highlight
  const srcDiv = document.querySelector(`.team[data-game-index="${src.gameIndex}"][data-team-side="${src.teamSide}"]`);
  const targetDiv = document.querySelector(`.team[data-game-index="${target.gameIndex}"][data-team-side="${target.teamSide}"]`);
  [srcDiv, targetDiv].forEach(div => {
    div.classList.add('swapping');
    setTimeout(() => div.classList.remove('swapping'), 600);
  });

  setTimeout(() => {
    // Swap teams safely using temporary variable
    const temp = data.games[src.gameIndex][srcKey];
    data.games[src.gameIndex][srcKey] = data.games[target.gameIndex][targetKey];
    data.games[target.gameIndex][targetKey] = temp;

    // Refresh the round
    showRound(index);

    swapInProgress = false;

    // Process next swap in queue if any
    if (swapQueue.length > 0) {
      const nextSwap = swapQueue.shift();
      handleTeamSwapAcrossCourts(nextSwap.src, nextSwap.target, nextSwap.data, nextSwap.index);
    }
  }, 300);
}


function handleTeamSwapAcrossCourts2(src, target, data, index) {
  if (!src || !target) return;
  if (src.gameIndex === target.gameIndex && src.teamSide === target.teamSide) return;
  const srcKey = src.teamSide === 'L' ? 'pair1' : 'pair2';
  const targetKey = target.teamSide === 'L' ? 'pair1' : 'pair2';
  const srcTeam = data.games[src.gameIndex][srcKey];
  const targetTeam = data.games[target.gameIndex][targetKey];
  // Animation highlight
  const srcDiv = document.querySelector(`.team[data-game-index="${src.gameIndex}"][data-team-side="${src.teamSide}"]`);
  const targetDiv = document.querySelector(`.team[data-game-index="${target.gameIndex}"][data-team-side="${target.teamSide}"]`);
  [srcDiv, targetDiv].forEach(div => {
    div.classList.add('swapping');
    setTimeout(() => div.classList.remove('swapping'), 600);
  });
  // Swap and refresh after short delay
  setTimeout(() => {
    data.games[src.gameIndex][srcKey] = [...targetTeam];
    data.games[target.gameIndex][targetKey] = [...srcTeam];
    showRound(index);
  }, 300);
}
/* =========================
 
PAGE NAVIGATION
 
========================= */
function resetRounds() {
  // 1️⃣ Clear all previous rounds
  allRounds.length = 0;
  goToRounds()
  const btn = document.getElementById('goToRoundsBtn');
  btn.enabled;
}
function goToRounds() {
  const numCourtsInput = parseInt(document.getElementById('num-courts').value);
  const totalPlayers = players.length;
  if (!totalPlayers) {
    alert('Please add players first!');
    return;
  }
  // Auto-calculate courts based on player count ÷ 4
  let autoCourts = Math.floor(totalPlayers / 4);
  if (autoCourts < 1) autoCourts = 1;
  // Use the smaller of user-input or calculated courts
  const numCourts = numCourtsInput
    ? Math.min(numCourtsInput, autoCourts)
    : autoCourts;
  if (!numCourts) {
    alert('Number of courts could not be determined!');
    return;
  }
  if (allRounds.length <= 1) {
    initScheduler(players.map(p => p.name), numCourts, fixedPairs);
    allRounds = [AischedulerNextRound()];
    currentRoundIndex = 0;
    showRound(0);
  } else {
        const changed =
        JSON.stringify(schedulerState.players) !== JSON.stringify(backupState.players) ||
        schedulerState.numCourts !== backupState.numCourts ||
        JSON.stringify(schedulerState.fixedPairs) !== JSON.stringify(backupState.fixedPairs);
    if (changed) {
       restoreSchedulerState();
       const playersList = players.map(p => p.name);
     schedulerState.players = [...playersList].reverse();
    schedulerState.numCourts = numCourts;
    schedulerState.fixedPairs = fixedPairs;
    schedulerState.fixedMap = new Map();
    let highestRestCount = -Infinity;
    updateScheduler(players.map(p => p.name));
    for (const p of playersList) {
      if (schedulerState.restCount.has(p)) {
        const count = schedulerState.restCount.get(p);
        if (count > highestRestCount) highestRestCount = count;
      }
    }
    for (const p of playersList) {
      if (!schedulerState.restCount.has(p)) {
        schedulerState.restCount.set(p, highestRestCount + 1);
      }
    }
    for (const p of Array.from(schedulerState.restCount.keys())) {
      if (!playersList.includes(p)) schedulerState.restCount.delete(p);
    }
     //allRounds.pop();
     schedulerState.roundIndex = allRounds.length - 1;
     allRounds[allRounds.length - 1]=AischedulerNextRound();
      //currentRoundIndex = currentRoundIndex + 1;
      showRound(currentRoundIndex);
    } else {
     showRound(currentRoundIndex);
      }
    }
  document.getElementById('page1').style.display = 'none';
  document.getElementById('page2').style.display = 'block';
  isOnPage2 = true;
}
function restoreSchedulerState() {
    schedulerState.restCount      = structuredClone(backupState.restCount);
    schedulerState.PlayedCount      = structuredClone(backupState.PlayedCount);
    schedulerState.playedTogether = structuredClone(backupState.playedTogether);
    schedulerState.pairPlayedSet  = new Set(backupState.pairPlayedSet);
    schedulerState.playerScoreMap = structuredClone(backupState.playerScoreMap);
    schedulerState.opponentMap    = structuredClone(backupState.opponentMap);
}
function backupSchedulerState() {
    backupState.restCount      = structuredClone(schedulerState.restCount);
    backupState.PlayedCount      = structuredClone(schedulerState.PlayedCount); 
    backupState.playedTogether = structuredClone(schedulerState.playedTogether);
    backupState.pairPlayedSet  = new Set(schedulerState.pairPlayedSet);
    backupState.playerScoreMap = structuredClone(schedulerState.playerScoreMap);
    backupState.opponentMap    = structuredClone(schedulerState.opponentMap);
}
function goBack() {
  // const pin = prompt("Enter 4-digit code to go back:");
  //if (pin === "0000") {
  updatePlayerList();
  document.getElementById('page1').style.display = 'block';
  document.getElementById('page2').style.display = 'none';
  isOnPage2 = false;
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = false;
  //} else if (pin !== null) alert("Incorrect PIN!");
}
function nextRound() {
  backupSchedulerState();
  if (currentRoundIndex + 1 < allRounds.length) {
    currentRoundIndex++;
    showRound(currentRoundIndex);
  } else {
    const newRound = AischedulerNextRound();
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 1;
    showRound(currentRoundIndex);
  }
}
function prevRound() {
  if (currentRoundIndex > 0) {
    currentRoundIndex--;
    showRound(currentRoundIndex);
  }
}
/* =========================
 
MOBILE BEHAVIOR
 
========================= */
function enableTouchDrag(el) {
  let offsetX = 0, offsetY = 0;
  let clone = null;
  let isDragging = false;
  const startDrag = (x, y) => {
    const rect = el.getBoundingClientRect();
    offsetX = x - rect.left;
    offsetY = y - rect.top;
    clone = el.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.opacity = '0.7';
    clone.style.zIndex = 9999;
    clone.classList.add('dragging');
    document.body.appendChild(clone);
    isDragging = true;
  };
  const moveDrag = (x, y) => {
    if (!clone) return;
    clone.style.left = `${x - offsetX}px`;
    clone.style.top = `${y - offsetY}px`;
  };
  const endDrag = () => {
    if (clone) {
      clone.remove();
      clone = null;
    }
    isDragging = false;
  };
  // --- Touch Events ---
  el.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
    e.preventDefault();
  });
  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  });
  el.addEventListener('touchend', endDrag);
  // --- Mouse Events ---
  el.addEventListener('mousedown', e => {
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) moveDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', endDrag);
}
// Warn before leaving or refreshing
window.addEventListener('beforeunload', function (e) {
  // Cancel the event
  e.preventDefault();
  // Some browsers require setting returnValue
  e.returnValue = '';
  // On mobile, this usually triggers a generic "Leave site?" dialog
});
window.onload = function () {
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = (allRounds.length === 0);
};
