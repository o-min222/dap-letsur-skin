import {readFileSync} from "node:fs";

const skin = JSON.parse(readFileSync(new URL("../assets/skin.json", import.meta.url), "utf8"));

export async function activate(ctx) {
  const api = ctx.host.petSkins;
  const available = api?.apiVersion === 2;
  const section = `${ctx.pluginId}.appearance`;
  const registration = available ? await api.registerSkin(skin) : null;
  let palette, offMessage, disposed = false, busy = false, owned = false;
  let queue = Promise.resolve();

  function push(message) {
    if (disposed || !palette || palette.isDestroyed()) return;
    const active = available && api.getActiveSkin() === registration.id;
    palette.postMessage({type: "status", available, active, busy,
      message: message ?? (active ? "렛서판다가 곁에 있어요." : available ? "준비됐어요. 렛서판다와 함께해 보세요." : "DAP 1.6.14 이상에서 사용할 수 있어요.")});
  }

  function change(type) {
    queue = queue.then(async () => {
      if (disposed || !available) return;
      busy = true;
      push();
      let message;
      try {
        if (type === "apply") {
          await registration.apply({usePersona: false});
          await ctx.host.settings.set(section, "enabled", true);
        } else if (type === "reset") {
          await registration.reset();
          await ctx.host.settings.set(section, "enabled", false);
        }
      } catch (error) {
        console.error("LETSUR skin:", error);
        message = "변경 내용을 저장하지 못했어요. 다시 시도해 주세요.";
      } finally {
        busy = false;
        push(message);
      }
    });
    return queue;
  }

  const offSkin = available ? api.onDidChange(() => {
    const active = api.getActiveSkin() === registration.id;
    // Switching to another skin must also cancel restoration of this skin.
    if (owned && !active && !disposed) {
      Promise.resolve().then(() => ctx.host.settings.set(section, "enabled", false))
        .catch(error => { console.error("LETSUR skin settings:", error); push("다음 실행을 위한 설정을 저장하지 못했어요."); });
    }
    owned = active;
    push();
  }) : null;

  function open() {
    if (disposed) return;
    if (palette && !palette.isDestroyed()) { palette.toggle(); push(); return; }
    offMessage?.();
    palette = ctx.host.windows.openPalette({page: "palette/index.html", width: 480, height: 660, frame: false, resizable: true});
    offMessage = palette.onMessage(message => {
      if (!message || typeof message !== "object" || disposed) return;
      if (message.type === "ready") push();
      else if (message.type === "apply" || message.type === "reset") return change(message.type);
    });
    palette.show();
  }

  ctx.actions.registerAction({id: "open", callback: open});
  ctx.trayMenu.addItem({itemId: "open", label: "LETSUR 렛서판다", actionId: "open", showInContextMenu: true});
  ctx.radialMenu.addItem({itemId: "open", label: "렛서판다", actionId: "open", priority: 50, icon: "icon.png"});
  if (available && ctx.host.settings.values(section).enabled === true) await change("apply");

  return async () => {
    disposed = true;
    offMessage?.();
    offSkin?.();
    palette?.close();
    await queue;
    await registration?.dispose();
  };
}
