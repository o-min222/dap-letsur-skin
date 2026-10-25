"use strict";
const skin = window.LETSUR_SKIN;
const labels = {idle:"잠깐 쉬는 중", "running-right":"오른쪽으로 총총", "running-left":"왼쪽으로 총총", waving:"반가워요!", jumping:"폴짝, 한 걸음 더", failed:"다시 해볼까요?", waiting:"기다리고 있어요", running:"열심히 일하는 중", review:"꼼꼼히 살펴보는 중", sleep:"꿈꾸는 중", feed_munch:"냠냠, 간식 시간", groom:"단정하게 쓱쓱", grabbed:"앗, 잡혔어요", success:"함께 해냈어요!", dance:"기분 좋은 순간", working_v2:"집중하는 중"};
const canvas = document.getElementById("pet"), drawing = canvas.getContext("2d");
const motion = document.getElementById("motion"), status = document.getElementById("status");
const apply = document.getElementById("apply"), reset = document.getElementById("reset"), pause = document.getElementById("pause");
const bridge = window.dapPalette, reduced = matchMedia("(prefers-reduced-motion: reduce)");
let ready = false, available = false, active = false, busy = false, loaded = false;
let paused = reduced.matches, elapsed = 0, previous, frameId, stopped = false;
for (const key of Object.keys(skin.animations)) {
  if (key === "working_v2" || key === "success") continue;
  const option = document.createElement("option"); option.value = key; option.textContent = labels[key]; motion.append(option);
}
function buttons() {
  apply.disabled = !ready || !available || busy || active;
  reset.disabled = !ready || !available || busy || !active;
  apply.firstChild.textContent = active ? "렛서판다와 함께하는 중 " : "렛서판다와 함께하기 ";
}
function render() {
  if (!loaded) return;
  const clip = skin.animations[motion.value], total = clip.holdsMs.reduce((a,b) => a+b, 0);
  let t = elapsed % total, col = 0;
  while (col < clip.holdsMs.length-1 && t >= clip.holdsMs[col]) t -= clip.holdsMs[col++];
  drawing.clearRect(0,0,192,208);
  drawing.drawImage(image,col*192,clip.row*208,192,208,0,0,192,208);
}
function tick(now) {
  if (stopped) return;
  if (previous !== undefined && !paused && !document.hidden) elapsed += now-previous;
  previous = now; render(); frameId = requestAnimationFrame(tick);
}
const image = new Image();
image.onload = () => {
  if (image.naturalWidth !== 192*skin.grid.columns || image.naturalHeight !== 208*skin.grid.rows) { status.textContent="미리보기 이미지 크기를 확인해 주세요."; return; }
  loaded = true; render(); frameId = requestAnimationFrame(tick);
};
image.onerror = () => { status.textContent = "캐릭터 이미지를 불러오지 못했어요."; };
image.src = "../"+skin.spritesheetPath;
motion.addEventListener("change", () => { elapsed=0; document.getElementById("motion-name").textContent=labels[motion.value]; canvas.setAttribute("aria-label", labels[motion.value]+" 렛서판다"); render(); });
function pauseLabel() { pause.textContent=paused?"▶":"Ⅱ"; pause.setAttribute("aria-pressed", String(paused)); pause.setAttribute("aria-label",paused?"애니메이션 재생":"애니메이션 일시정지"); }
pause.addEventListener("click", () => { paused=!paused; pauseLabel(); });
const reduceChange = () => { paused=reduced.matches; pauseLabel(); }; reduced.addEventListener("change",reduceChange); pauseLabel();
document.addEventListener("visibilitychange", () => { previous=undefined; });
document.getElementById("close").addEventListener("click", () => bridge?.close());
function send(type) { if (bridge && available && !busy) { busy=true; buttons(); bridge.postMessage({type}); } }
apply.addEventListener("click", () => send("apply")); reset.addEventListener("click", () => send("reset"));
let off;
if (bridge) {
  off=bridge.onMessage(message => {
    if (!message || message.type !== "status") return;
    ready=true; available=message.available===true; active=message.active===true; busy=message.busy===true;
    status.textContent=typeof message.message === "string" ? message.message : ""; buttons();
  });
  bridge.postMessage({type:"ready"});
} else { status.textContent="모션을 미리 볼 수 있어요. DAP에서 열면 캐릭터를 적용할 수 있어요."; document.getElementById("close").hidden=true; }
buttons();
window.addEventListener("pagehide",()=>{stopped=true;cancelAnimationFrame(frameId);off?.();reduced.removeEventListener("change",reduceChange);},{once:true});
