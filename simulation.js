const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// ─── 캔버스 크기 설정 ───
function resizeCanvas() {
  const wrap = canvas.parentElement;
  const size = Math.min(wrap.clientWidth - 24, wrap.clientHeight - 24, 900);
  canvas.width = size;
  canvas.height = size;
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); draw(); });

// ─── 시뮬레이션 설정 ───
const TOTAL_TIME = 7.0;   // 총 시간 (초)
const COLLISION_T = 5.3;  // 충돌 시점

let currentTime = 0;
let playing = true;
let lastTimestamp = null;
let speed = 1.0;

// ─── 차량 경로 정의 ───
// 각 차량은 시간에 따라 위치와 각도를 반환하는 함수로 정의
function getCarA(t) {
  // 차량 A: 위에서 아래로 직진 (1차선)
  const startY = 0.1;
  const endY = 0.85;
  const brakeStart = 4.1;
  let y;

  if (t < brakeStart) {
    y = startY + (t / TOTAL_TIME) * (endY - startY) * (TOTAL_TIME / brakeStart) * 0.85;
  } else {
    // 브레이크 후 감속
    const bt = t - brakeStart;
    const maxBt = COLLISION_T - brakeStart;
    y = startY + 0.42 + Math.pow(bt / maxBt, 0.5) * 0.14;
  }

  const kmh = t < brakeStart ? 42 : Math.max(0, 42 - (t - brakeStart) * 22);
  return { x: 0.42, y: Math.min(y, 0.58), angle: Math.PI / 2, kmh: Math.round(kmh) };
}

function getCarB(t) {
  // 차량 B: 왼쪽에서 오른쪽으로 이동 후 좌회전 시도
  if (t < 2.5) {
    return { x: -0.05, y: 0.52, angle: 0, kmh: 0 };
  }
  const et = t - 2.5;
  const duration = COLLISION_T - 2.5;
  const progress = Math.min(et / duration, 1);
  // 왼쪽에서 교차로 중심으로 이동
  const x = 0.05 + progress * 0.38;
  // 좌회전 각도
  const angle = progress * (-Math.PI / 4);
  const kmh = Math.round(31 * Math.min(progress * 2, 1));
  return { x, y: 0.52, angle, kmh };
}

// ─── 충돌 후 상태 ───
function getPostCollision(t) {
  const pt = t - COLLISION_T;
  const a = getCarA(COLLISION_T);
  const b = getCarB(COLLISION_T);
  return {
    carA: { x: a.x + pt * 0.02, y: a.y + pt * 0.04, angle: a.angle + pt * 0.15, kmh: Math.max(0, 8 - pt * 8) },
    carB: { x: b.x + pt * 0.06, y: b.y - pt * 0.05, angle: b.angle - pt * 0.3, kmh: Math.max(0, 14 - pt * 14) },
  };
}

// ─── 그리기 유틸 ───
function toCanvas(rx, ry) {
  return { x: rx * canvas.width, y: ry * canvas.height };
}

function drawRoad() {
  const W = canvas.width;
  const H = canvas.height;
  const cx = W * 0.5;
  const cy = H * 0.5;
  const laneW = W * 0.12;

  // 배경
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, W, H);

  // 격자 보조선
  ctx.strokeStyle = '#1a2235';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += W / 10) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
  }

  // 세로 도로 (차량 A 진행 방향)
  ctx.fillStyle = '#1c2333';
  ctx.fillRect(cx - laneW * 1.5, 0, laneW * 3, H);

  // 가로 도로 (차량 B 진행 방향)
  ctx.fillRect(0, cy - laneW * 1.2, W, laneW * 2.4);

  // 교차로 중심
  ctx.fillStyle = '#232d42';
  ctx.fillRect(cx - laneW * 1.5, cy - laneW * 1.2, laneW * 3, laneW * 2.4);

  // 차선 중앙선 (세로 도로)
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 16]);
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
  ctx.stroke();

  // 차선 중앙선 (가로 도로)
  ctx.beginPath();
  ctx.moveTo(0, cy); ctx.lineTo(W, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // 가장자리 흰 선
  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = 2;
  [[cx - laneW * 1.5, 0, cx - laneW * 1.5, H],
   [cx + laneW * 1.5, 0, cx + laneW * 1.5, H],
   [0, cy - laneW * 1.2, W, cy - laneW * 1.2],
   [0, cy + laneW * 1.2, W, cy + laneW * 1.2]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });

  // 신호등 (교차로 모서리)
  drawTrafficLight(cx + laneW * 1.5 + 10, cy - laneW * 1.2 - 24, currentTime > 0 ? 'red' : 'green');
}

function drawTrafficLight(x, y, state) {
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(x, y, 18, 24, 3);
  ctx.fill();
  ctx.fillStyle = state === 'red' ? '#ef4444' : '#22c55e';
  ctx.beginPath();
  ctx.arc(x + 9, y + state === 'red' ? 7 : 17, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(rx, ry, angle, color, label, kmh) {
  const { x, y } = toCanvas(rx, ry);
  const W = canvas.width;
  const carW = W * 0.065;
  const carH = W * 0.035;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 차체
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-carW / 2, -carH / 2, carW, carH, 4);
  ctx.fill();

  // 앞유리 (진행 방향 표시)
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(carW * 0.15, -carH * 0.35, carW * 0.28, carH * 0.7, 2);
  ctx.fill();

  // 방향 화살표
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(carW * 0.52, 0);
  ctx.lineTo(carW * 0.36, -carH * 0.28);
  ctx.lineTo(carW * 0.36, carH * 0.28);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 라벨
  ctx.fillStyle = color;
  ctx.font = `bold ${W * 0.022}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - carH / 2 - 10);

  // 속도
  ctx.fillStyle = '#fff';
  ctx.font = `${W * 0.017}px sans-serif`;
  ctx.fillText(kmh + ' km/h', x, y - carH / 2 - 26);
}

function drawCollisionEffect(t) {
  if (t < COLLISION_T || t > COLLISION_T + 1.0) return;
  const pt = t - COLLISION_T;
  const { x, y } = toCanvas(0.44, 0.56);
  const alpha = Math.max(0, 1 - pt * 1.5);
  const radius = canvas.width * 0.07 * (1 + pt * 2);

  // 충돌 폭발 원
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 충돌 텍스트
  if (pt < 0.5) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - pt * 2);
    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${canvas.width * 0.04}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('충돌!', x, y - canvas.width * 0.08);
    ctx.restore();
  }
}

function drawTimestamp(t) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 110, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${canvas.width * 0.028}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(t.toFixed(1) + 's / ' + TOTAL_TIME + 's', 20, 33);
}

// ─── 메인 드로우 ───
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();

  let carA, carB;

  if (currentTime >= COLLISION_T) {
    const post = getPostCollision(currentTime);
    carA = post.carA;
    carB = post.carB;
  } else {
    carA = getCarA(currentTime);
    carB = getCarB(currentTime);
  }

  drawCollisionEffect(currentTime);
  drawCar(carA.x, carA.y, carA.angle, '#3b82f6', 'A', carA.kmh);
  if (currentTime >= 2.5) {
    drawCar(carB.x, carB.y, carB.angle, '#f97316', 'B', carB.kmh);
  }
  drawTimestamp(currentTime);

  // 사이드 패널 속도 업데이트
  document.getElementById('speedA').textContent = carA.kmh + ' km/h';
  document.getElementById('speedB').textContent = currentTime >= 2.5 ? carB.kmh + ' km/h' : '0 km/h';

  // 타임라인 업데이트
  const pct = (currentTime / TOTAL_TIME) * 100;
  document.getElementById('timelineBar').value = pct;
  document.getElementById('curTime').textContent = currentTime.toFixed(1) + 's';
}

// ─── 애니메이션 루프 ───
function animate(ts) {
  if (playing) {
    if (lastTimestamp !== null) {
      const delta = (ts - lastTimestamp) / 1000;
      currentTime = Math.min(currentTime + delta * speed, TOTAL_TIME);
      if (currentTime >= TOTAL_TIME) playing = false;
    }
    lastTimestamp = ts;
  } else {
    lastTimestamp = null;
  }
  draw();
  requestAnimationFrame(animate);
}

// ─── 컨트롤 이벤트 ───
const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', () => {
  if (currentTime >= TOTAL_TIME) currentTime = 0;
  playing = !playing;
  playBtn.textContent = playing ? '⏸' : '▶';
  playBtn.classList.toggle('active', playing);
});

document.getElementById('rewindBtn').addEventListener('click', () => {
  currentTime = 0;
  playing = false;
  playBtn.textContent = '▶';
  playBtn.classList.remove('active');
  draw();
});

document.getElementById('timelineBar').addEventListener('input', (e) => {
  currentTime = (e.target.value / 100) * TOTAL_TIME;
  playing = false;
  playBtn.textContent = '▶';
  playBtn.classList.remove('active');
  draw();
});

document.getElementById('speedSelect').addEventListener('change', (e) => {
  speed = parseFloat(e.target.value);
});

// ─── 시작 ───
requestAnimationFrame(animate);
