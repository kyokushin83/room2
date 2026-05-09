const GAME_KEY = "petMissionGame";
const TOTAL_HINT_LIMIT = 2;

function getMissionId() {
  const params = new URLSearchParams(location.search);
  return Number(params.get("id") || 1);
}

function getMission() {
  const id = getMissionId();
  return MISSIONS[id] || MISSIONS[1];
}

function missionKey(id) {
  return `mission${id}`;
}

function timerKey(id) {
  return `mission${id}_timer_end`;
}

function createInitialGame() {
  return {
    startedAt: null,
    totalHintLimit: TOTAL_HINT_LIMIT,
    usedHints: 0,

    missions: {},

    rewards: {},
    claimedRewards: {},

    items: {}
  };
}

function getGame() {
  const saved = localStorage.getItem(GAME_KEY);
  if (!saved) return createInitialGame();

  try {
    return JSON.parse(saved);
  } catch {
    return createInitialGame();
  }
}

function saveGame(game) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

function ensureGameBase(game) {
  if (!game.startedAt) game.startedAt = Date.now();

  if (!game.totalHintLimit) {
    game.totalHintLimit = TOTAL_HINT_LIMIT;
  }

  if (typeof game.usedHints !== "number") {
    game.usedHints = 0;
  }

  if (!game.missions) {
    game.missions = {};
  }

  if (!game.rewards) {
    game.rewards = {};
  }

  if (!game.claimedRewards) {
    game.claimedRewards = {};
  }

  if (!game.items) {
    game.items = {};
  }

  return game;
}

function initMission() {
  const mission = getMission();
  const key = missionKey(mission.id);

  let game = getGame();
  game = ensureGameBase(game);

  markPreviousMissionSuccess(mission.id, game);

  if (!game.missions[key]) {
    game.missions[key] = {
      startedAt: Date.now(),
      completedAt: null,
      hintUsed: false,
      hintCount: 0,
      answerViewed: false,
      failed: false
    };
  }

  saveGame(game);
}

function markPreviousMissionSuccess(currentMissionId, game) {
  if (currentMissionId <= 1) return;

  const prevKey = missionKey(currentMissionId - 1);
  const prev = game.missions[prevKey];

  if (!prev) return;
  if (prev.completedAt) return;
  if (prev.failed) return;

  prev.completedAt = Date.now();
  prev.failed = false;
}

function initTimer() {
  const mission = getMission();
  const key = timerKey(mission.id);

  let endTime = Number(localStorage.getItem(key));

  if (!endTime || isNaN(endTime) || endTime < Date.now()) {
    endTime = Date.now() + mission.timeLimit * 60 * 1000;
    localStorage.setItem(key, String(endTime));
  }

  return endTime;
}

function formatClock(ms) {
  if (!ms || ms < 0) return "00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function formatTimeText(ms) {
  if (!ms || ms < 0) return "-";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}분 ${seconds}초`;
}


function updateGlobalTimer() {
  const game = getGame();

  const globalTimeValue =
    document.getElementById("globalTimeValue") ||
    document.getElementById("timeValue");

  if (!globalTimeValue) return;

  if (!game.startedAt) {
    globalTimeValue.textContent = "00:00";
    return;
  }

  const elapsed = Date.now() - game.startedAt;
  globalTimeValue.textContent = formatClock(elapsed);
}

function updateMissionTimer() {
  const mission = getMission();
  const key = missionKey(mission.id);
  const timerEl = document.getElementById("timer");
  const missionTimeValue = document.getElementById("missionTimeValue");

  if (!timerEl || !missionTimeValue) return;

  let endTime = Number(localStorage.getItem(timerKey(mission.id)));

  if (!endTime || isNaN(endTime)) {
    endTime = initTimer();
  }

  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    missionTimeValue.textContent = "시간 종료";
    timerEl.classList.add("warning");

    let game = getGame();

    if (
      game.missions &&
      game.missions[key] &&
      !game.missions[key].completedAt
    ) {
      game.missions[key].failed = true;
      game.missions[key].completedAt = Date.now();
      saveGame(game);

      alert("시간이 종료되었습니다.\n본 미션은 실패 처리됩니다.\n정답 페이지로 이동합니다.");
      location.href = `mission_answer.html?id=${mission.id}`;
    }

    return;
  }

  missionTimeValue.textContent = formatClock(remaining);

  if (remaining <= 60000) {
    timerEl.classList.add("warning");
  }
}
function updateHintMini() {
  const hintMini = document.getElementById("hintMini");
  if (!hintMini) return;

  const game = getGame();
  const limit = game.totalHintLimit || TOTAL_HINT_LIMIT;
  const used = typeof game.usedHints === "number" ? game.usedHints : 0;
  const remainHints = Math.max(0, limit - used);

  hintMini.textContent = `힌트 ${remainHints}/${limit}`;
}

function useHint() {
  const mission = getMission();
  const key = missionKey(mission.id);

  let game = getGame();
  game = ensureGameBase(game);

  if (!game.missions[key]) {
    game.missions[key] = {
      startedAt: Date.now(),
      completedAt: null,
      hintUsed: false,
      hintCount: 0,
      answerViewed: false,
      failed: false
    };
  }

  const remainHints = game.totalHintLimit - game.usedHints;

  if (remainHints <= 0) {
    alert("남은 힌트가 없습니다.");
    return;
  }

  const ok = confirm(
    `힌트는 전체 ${game.totalHintLimit}회까지만 사용 가능합니다.\n` +
    `현재 남은 힌트는 ${remainHints}회입니다.\n\n` +
    `힌트를 사용하시겠습니까?`
  );

  if (!ok) return;

  game.usedHints += 1;
  game.missions[key].hintUsed = true;
  game.missions[key].hintCount += 1;

  saveGame(game);
  updateHintMini();

  location.href = `mission_hint.html?id=${mission.id}`;
}

function confirmAnswer() {
  const ok = confirm(
    "정답 보기 버튼 클릭 시 본 미션은 실패하게 됩니다.\n\n" +
    "정답을 확인하시겠습니까?"
  );

  if (!ok) return;

  failMissionAndGoAnswer();
}

function failMissionAndGoAnswer() {
  const mission = getMission();
  const key = missionKey(mission.id);

  let game = getGame();
  game = ensureGameBase(game);

  if (!game.missions[key]) {
    game.missions[key] = {
      startedAt: Date.now(),
      completedAt: null,
      hintUsed: false,
      hintCount: 0,
      answerViewed: false,
      failed: false
    };
  }

  game.missions[key].answerViewed = true;
  game.missions[key].failed = true;
  game.missions[key].completedAt = Date.now();

  saveGame(game);

  location.href = `mission_answer.html?id=${mission.id}`;
}

function renderRecord() {
  const game = getGame();
  const totalElapsed = game.startedAt ? Date.now() - game.startedAt : 0;
  const limit = game.totalHintLimit || TOTAL_HINT_LIMIT;
  const used = typeof game.usedHints === "number" ? game.usedHints : 0;
  const remainHints = Math.max(0, limit - used);

  let html = `
    <div class="record-box">
      <b>전체 진행 시간</b><br />
      ${game.startedAt ? formatTimeText(totalElapsed) : "아직 시작 전"}
    </div>

    <div class="record-box">
      <b>힌트</b><br />
      사용: ${used}회 / 최대: ${limit}회<br />
      남은 힌트: ${remainHints}회
    </div>
  `;

  Object.keys(MISSIONS).forEach((id) => {
    const mission = MISSIONS[id];
    const key = missionKey(mission.id);
    const record = game.missions?.[key] || {};

    let status = "진행 전";

    if (record.failed) {
      status = "실패 ❌";
    } else if (record.completedAt) {
      status = "성공 ✅";
    } else if (record.startedAt) {
      status = "진행 중";
    }

    html += `
      <div class="record-box">
        <b>미션 ${mission.id}</b><br />
        상태: ${status}<br />
        소요 시간: ${
          record.startedAt && record.completedAt
            ? formatTimeText(record.completedAt - record.startedAt)
            : record.startedAt
              ? formatTimeText(Date.now() - record.startedAt)
              : "-"
        }<br />
        힌트 사용: ${record.hintCount || 0}회<br />
        정답 보기: ${record.answerViewed ? "사용함" : "사용 안 함"}
      </div>
    `;
  });

  const recordContent = document.getElementById("recordContent");
  if (recordContent) recordContent.innerHTML = html;
}

function openPanel() {
  renderRecord();
  document.getElementById("panelBg").style.display = "flex";
}

function closePanel() {
  document.getElementById("panelBg").style.display = "none";
}

function resetGame() {
  const password = prompt("관리자 비밀번호를 입력하세요.");

  if (password !== "1234") {
    alert("비밀번호가 틀렸습니다.");
    return;
  }

  localStorage.removeItem(GAME_KEY);

  Object.keys(MISSIONS).forEach((id) => {
    localStorage.removeItem(timerKey(id));
  });

  alert("기록이 초기화되었습니다.");

  updateGlobalTimer();
  updateHintMini();
  renderRecord();
}

function startGame() {
  let game = getGame();

  if (!game.startedAt) {
    game.startedAt = Date.now();
  }

  game.totalHintLimit = game.totalHintLimit || TOTAL_HINT_LIMIT;

  if (typeof game.usedHints !== "number") {
    game.usedHints = 0;
  }

  if (!game.missions) {
    game.missions = {};
  }

  saveGame(game);
  updateGlobalTimer();
  updateHintMini();

  location.href = "mission.html?id=1";
}
const COUPON_ITEMS = [
  { id: "catCafe", emoji: "🐱", name: "고양이카페 30% 할인쿠폰" },
  { id: "cotonCafe", emoji: "🐶", name: "꼬똥카페 30% 할인쿠폰" },
  { id: "animalCafe", emoji: "🦜", name: "애니멀카페 30% 할인쿠폰" },
  { id: "rcCafe", emoji: "🏎", name: "RC카카페 30% 할인쿠폰" },
  { id: "vetExperience", emoji: "🩺", name: "수의사체험 30% 할인쿠폰" },
  { id: "clawMachine", emoji: "🧸", name: "인형뽑기카페 30% 할인쿠폰" }
];

function drawRewardCoupon() {
  let game = getGame();
  game = ensureGameBase(game);

  if (!game.items) {
    game.items = {};
  }

  const availableCoupons = COUPON_ITEMS.filter((item) => {
    return !game.items[item.id];
  });

  const isLose = Math.random() < 0.7;

  if (isLose || availableCoupons.length === 0) {
    return {
      type: "lose",
      message: "아쉽게도 이번 룰렛은 꽝입니다!"
    };
  }

  const selected =
    availableCoupons[
      Math.floor(Math.random() * availableCoupons.length)
    ];

  game.items[selected.id] = 1;

  saveGame(game);

  return {
    type: "coupon",
    item: selected,
    message: `${selected.emoji} ${selected.name} 획득!`
  };
}

function shouldShowRewardForPreviousMission(currentMissionId) {
  /*
    REAL FIX:
    In this QR game, arriving at mission N means mission N-1 was cleared by scanning QR.
    Earlier versions required an existing prev.completedAt record, so direct QR entry,
    cache/test states, or old localStorage could hide the reward button completely.
    Now the reward button is shown for every mission after 1 unless that previous
    mission reward was actually claimed.
  */
  if (currentMissionId <= 1) {
    return false;
  }

  const prevMissionId = currentMissionId - 1;

  let game = getGame();
  game = ensureGameBase(game);

  if (!game.claimedRewards) {
    game.claimedRewards = {};
  }

  const rewardKey = `mission${prevMissionId}`;

  return !game.claimedRewards[rewardKey];
}

function markRewardClaimedForPreviousMission(currentMissionId) {
  if (currentMissionId <= 1) {
    return;
  }

  const prevMissionId = currentMissionId - 1;

  let game = getGame();
  game = ensureGameBase(game);

  if (!game.claimedRewards) {
    game.claimedRewards = {};
  }

  const rewardKey = `mission${prevMissionId}`;
  game.claimedRewards[rewardKey] = true;

  /* rewards is kept only for old save compatibility.
     New reward button visibility uses claimedRewards so older auto-roulette tests
     do not accidentally hide the button forever. */
  if (!game.rewards) {
    game.rewards = {};
  }

  saveGame(game);
}
