let allRounds = [];
let currentRoundIndex = 0;
let isOnPage2 = false;

let schedulerState = {
    numCourts: 0,
    allPlayers: [],
    activeplayers: [],
    fixedPairs: [],
    PlayedCount: new Map(),
    restCount: new Map(),
    PlayerScoreMap: new Map(),
    playedTogether: new Map(),
    fixedMap: new Map(),
    roundIndex: 0,
    pairPlayedSet: new Set(),
    opponentMap: new Map(), // 🆕 per-player opponent tracking
};



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
    if (name && !schedulerState.allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      schedulerState.allPlayers.push({ name, gender, active: true });
    }
  });
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

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
  if (name && !schedulerState.allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    schedulerState.allPlayers.push({ name, gender, active: true });
    schedulerState.activeplayers = schedulerState.allPlayers
      .filter(p => p.active)
      .map(p => p.name)
      .reverse();

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
  schedulerState.allPlayers[i][field] = (field === 'active') ? val : val.trim();
   schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
}
/* =========================
   DELETE PLAYER
========================= */
function deletePlayer(i) {
  schedulerState.allPlayers.splice(i, 1);
   schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

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

  schedulerState.allPlayers.forEach((p, i) => {
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
  schedulerState.allPlayers = updated;
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

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
  const pairedPlayers = new Set(schedulerState.fixedPairs.flat());
  sel1.innerHTML = '<option value="">-- Select Player 1 --</option>';
  sel2.innerHTML = '<option value="">-- Select Player 2 --</option>';
  // Only active players
  schedulerState.activeplayers.forEach(p => {
    if (!pairedPlayers.has(p)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');
      option1.value = option2.value = p;
      option1.textContent = option2.textContent = p;
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
  const alreadyExists = schedulerState.fixedPairs.some(pair => pair.sort().join('&') === pairKey);
  if (alreadyExists) {
    alert(`Fixed pair "${p1} & ${p2}" already exists.`);
    return;
  }
  schedulerState.fixedPairs.push([p1, p2]);
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
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => !(pair[0] === p1 && pair[1] === p2));
  el.parentElement.remove();
  updateFixedPairSelectors();
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
  const totalPlayers = schedulerState.activeplayers.length;
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
    initScheduler(numCourts);
    allRounds = [AischedulerNextRound(schedulerState)];
    currentRoundIndex = 0;
    showRound(0);
  } else {   
      schedulerState.numCourts = numCourts;      
      schedulerState.fixedMap = new Map();
      let highestRestCount = -Infinity;
      updateScheduler();
      for (const p of schedulerState.activeplayers) {
        if (schedulerState.restCount.has(p)) {
          const count = schedulerState.restCount.get(p);
          if (count > highestRestCount) highestRestCount = count;
        }
      }
      for (const p of schedulerState.activeplayers) {
        if (!schedulerState.restCount.has(p)) {
          schedulerState.restCount.set(p, highestRestCount + 1);
        }
      }
      for (const p of Array.from(schedulerState.restCount.keys())) {
        if (!schedulerState.activeplayers.includes(p)) schedulerState.restCount.delete(p);
      }
      //allRounds.pop();
      schedulerState.roundIndex = allRounds.length - 1;
      currentRoundIndex = schedulerState.roundIndex;
      const newRound = AischedulerNextRound(schedulerState);
      allRounds[allRounds.length - 1] = newRound;
       showRound(currentRoundIndex);

      //
      //currentRoundIndex = schedulerState.roundIndex;
      

      //if (allRounds.length > 0) {
        // overwrite last
        
      //} else {
        // first round
      //  allRounds.push(newRound);
      //}    
 
    }  
  document.getElementById('page1').style.display = 'none';
  document.getElementById('page2').style.display = 'block';
  isOnPage2 = true;
}

function goBack() {
  updatePlayerList();
  document.getElementById('page1').style.display = 'block';
  document.getElementById('page2').style.display = 'none';
  isOnPage2 = false;
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = false;
}

function nextRound() {
  if (currentRoundIndex + 1 < allRounds.length) {
    currentRoundIndex++;
    showRound(currentRoundIndex);
  } else {
    updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
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

function initScheduler(numCourts) {
  schedulerState.numCourts = numCourts;  
  schedulerState.restCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayedCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayerScoreMap = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.playedTogether = new Map();
  schedulerState.fixedMap = new Map();
  schedulerState.pairPlayedSet = new Set();
  schedulerState.roundIndex = 0;
  // 🆕 Initialize opponentMap — nested map for opponent counts
  schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
  // Map each fixed pair for quick lookup
  schedulerState.fixedPairs.forEach(([a, b]) => {
    schedulerState.fixedMap.set(a, b);
    schedulerState.fixedMap.set(b, a);
  });
}
function updateScheduler() {
   schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
}

function updSchedule(roundIndex, schedulerState) {
  const data = allRounds[roundIndex];
  if (!data) return;

  const { games, resting } = data;
  const {
    restCount,
    PlayedCount,
    PlayerScoreMap,
    opponentMap,
    pairPlayedSet,
    playedTogether, // <<-- Missing in your version
  } = schedulerState;

  // 1️⃣ Update rest count
  for (const p of resting) {
    const playerName = p.split('#')[0];
    restCount.set(playerName, (restCount.get(playerName) || 0) + 1);
  }

  // 2️⃣ Update PlayedCount
  for (const game of games) {
    const allPlayers = [...game.pair1, ...game.pair2];
    for (const p of allPlayers) {
      PlayedCount.set(p, (PlayedCount.get(p) || 0) + 1);
    }
  }

  // 3️⃣ Update opponentMap & PlayerScoreMap
  for (const game of games) {
    const { pair1, pair2 } = game;

    // Ensure maps exist (prevents null errors)
    for (const a of [...pair1, ...pair2]) {
      if (!opponentMap.has(a)) opponentMap.set(a, new Map());
    }

    // Opponent tracking
    for (const a of pair1) {
      for (const b of pair2) {
        opponentMap.get(a).set(b, (opponentMap.get(a).get(b) || 0) + 1);
        opponentMap.get(b).set(a, (opponentMap.get(b).get(a) || 0) + 1);
      }
    }

    // Score calculation (new opponents bonus)
    for (const group of [pair1, pair2]) {
      for (const player of group) {
        let newOpponents = 0;
        const rivals = group === pair1 ? pair2 : pair1;

        for (const r of rivals) {
          if (opponentMap.get(player).get(r) === 1) newOpponents++;
        }

        const score = newOpponents === 2 ? 2 : newOpponents === 1 ? 1 : 0;
        PlayerScoreMap.set(player, (PlayerScoreMap.get(player) || 0) + score);
      }
    }
  }

  // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
    for (const pr of [game.pair1, game.pair2]) {
      const key = pr.slice().sort().join("&");
      pairPlayedSet.add(key);
      playedTogether.set(key, roundIndex); // <<-- IMPORTANT FIX
    }
  }
}



 
