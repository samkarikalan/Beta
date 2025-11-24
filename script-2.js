// ==============================
// Generate next round (no global updates)
// ==============================
function AischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  // Separate fixed pairs and free players
  const fixedPairPlayers = new Set(fixedPairs.flat());
  let freePlayers = activeplayers.filter(p => !fixedPairPlayers.has(p));

  // ... top of function (resting and playing already declared as let)
let resting = [];
let playing = [];

// 1. Select resting and playing players
if (fixedPairs.length > 0 && numResting >= 2) {
  const fixedPairsList = fixedPairs.map(([a, b]) => [a, b]);
  let possibleUnits = [
    ...fixedPairsList,
    ...freePlayers.map(p => [p])
  ];

  // Sort: prefer resting units with fewest total rests
  // Then: units with lower max turnOrder (rested longer ago) rest first
  possibleUnits.sort((u1, u2) => {
    const restSum1 = u1.reduce((sum, p) => sum + (restCount.get(p) || 0), 0);
    const restSum2 = u2.reduce((sum, p) => sum + (restCount.get(p) || 0), 0);
    if (restSum1 !== restSum2) return restSum1 - restSum2;

    const maxOrder1 = Math.max(...u1.map(name =>
      schedulerState.allPlayers.find(p => p.name === name)?.turnOrder ?? 0
    ));
    const maxOrder2 = Math.max(...u2.map(name =>
      schedulerState.allPlayers.find(p => p.name === name)?.turnOrder ?? 0
    ));

    return maxOrder1 - maxOrder2; // lower turnOrder = rested longer ago = rest now
  });

  // Greedily assign whole units to resting
  for (const unit of possibleUnits) {
    if (resting.length + unit.length <= numResting) {
      resting.push(...unit);
    }
    if (resting.length >= numResting) break;
  }

  // Everyone else plays (up to required number)
  playing = activeplayers
    .filter(p => !resting.includes(p))
    .slice(0, numPlayersPerRound);

  // Optional: preserve fixed pair order in playing list (not required, but nice)
  const playingSet = new Set(playing);
  const intactFixedPairs = fixedPairsList.filter(([a, b]) =>
    playingSet.has(a) && playingSet.has(b)
  );
  const playingFromPairs = intactFixedPairs.flat();
  const playingSingles = playing.filter(p => !fixedPairPlayers.has(p));
  playing = [...playingFromPairs, ...playingSingles];

} else {
  // NO FIXED PAIRS or not enough resting spots → treat everyone individually

  // Helper to get priority: fewer rests first, then most recently played rests last
  const getPriority = (name) => {
    const rests = restCount.get(name) || 0;
    const turnOrder = schedulerState.allPlayers.find(p => p.name === name)?.turnOrder ?? -Infinity;
    return { rests, turnOrder };
  };

  const sortedPlayers = [...activeplayers].sort((a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);

    if (pa.rests !== pb.rests) return pa.rests - pb.rests;     // fewer rests = rest now
    return pb.turnOrder - pa.turnOrder; // higher turnOrder = returned more recently = play now
  });

  // Assign resting players (do NOT redeclare resting!)
  resting.push(...sortedPlayers.slice(0, numResting));

  // Remaining players go to playing
  playing = activeplayers
    .filter(p => !resting.includes(p))
    .slice(0, numPlayersPerRound);
}
  // 2️⃣ Prepare pairs
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(p => !fixedPairPlayersThisRound.has(p));
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs = requiredPairsCount - fixedPairsThisRound.length;

  let selectedPairs = findDisjointPairs(freePlayersThisRound, schedulerState.pairPlayedSet, neededFreePairs, opponentMap);

  let finalFreePairs = selectedPairs || [];

  // Fallback pairing for leftovers
  if (finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;
        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }
      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  // 3️⃣ Combine all pairs and shuffle
  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  allPairs = shuffle(allPairs);

  // 4️⃣ Create games (courts) using matchupScores (no updates here)
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
    if (games.length >= numCourts) break;
  }

  // 5️⃣ Prepare resting display with +1 for current round
  const restingWithNumber = resting.map(p => {
    const currentRest = restCount.get(p) || 0;
    return `${p}#${currentRest + 1}`;
  });

 schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };

  
}

// ==============================



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

function handleDropRestToTeam(
  e, teamSide, gameIndex, playerIndex, data, roundIndex, movingPlayer = null
) {
  const drop = !movingPlayer && e.dataTransfer
    ? JSON.parse(e.dataTransfer.getData('text/plain'))
    : { type: 'rest', player: movingPlayer };

  if (drop.type !== 'rest' || !drop.player) return;

  const teamKey = teamSide === 'L' ? 'pair1' : 'pair2';

  const newPlayer = drop.player.replace(/#\d+$/, '');
  const oldPlayer = data.games[gameIndex][teamKey][playerIndex];

  // Remove the new player from data.resting
  data.resting = data.resting.filter(p => !p.startsWith(newPlayer));

  // Insert new player into team
  data.games[gameIndex][teamKey][playerIndex] = newPlayer;

  // ---------------------------------------------
  // 🔥 schedulerState.restCount is READ-ONLY
  // ---------------------------------------------
  const { restCount } = schedulerState;

  if (oldPlayer && oldPlayer !== '(Empty)') {

    // Read only value
    const stored = restCount.get(oldPlayer) || 0;

    // UI number = scheduler stored + 1
    const nextNum = stored + 1;

    // Add to data.resting
    data.resting.push(`${oldPlayer}#${nextNum}`);
  }

  showRound(roundIndex);
}
function handleDropRestToTeam2(e, teamSide, gameIndex, playerIndex, data, index, movingPlayer = null) {
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


// Update global scheduler state after round



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
