(() => {
  "use strict";

  const VERSION = "7.10.4";
  const HIDDEN = "data-eos-role-hidden";
  const READONLY = "data-eos-readonly";
  const state = { role: "unknown", backupActive: null, user: "", appliedAt: 0 };

  const adminOnlyTokens = [
    "app-center", "app center", "appcenter", "lizenz", "license", "simulation", "simulator",
    "expertenmodus", "expert mode", "xterm", "shell-konsole", "shell console", "zugänge & rechte",
    "zugaenge & rechte", "access & rights", "user management", "benutzerverwaltung"
  ];
  const backupTokens = ["sicherung", "backup", "backitup"];
  const dataPointTokens = ["datenpunkte", "datapoints", "objects", "objekte"];
  const dangerousWriteTokens = [
    "wert schreiben", "wert setzen", "schreiben", "write value", "set value", "setstate", "speichern",
    "save", "anwenden", "apply", "löschen", "delete", "bearbeiten", "edit", "stift"
  ];

  const normalize = value => String(value == null ? "" : value).trim().toLowerCase();
  const textOf = el => normalize([
    el && el.textContent,
    el && el.getAttribute && el.getAttribute("title"),
    el && el.getAttribute && el.getAttribute("aria-label"),
    el && el.getAttribute && el.getAttribute("data-testid"),
    el && el.getAttribute && el.getAttribute("href"),
    el && el.getAttribute && el.getAttribute("to"),
    el && el.id,
    el && el.className && typeof el.className === "string" ? el.className : ""
  ].filter(Boolean).join(" "));

  function classify(value) {
    const text = normalize(value);
    if (!text) return "unknown";
    if (/^(?:system\.user\.)?admin(?:istrator)?$/.test(text) || /(?:^|[.:/_ -])admin(?:istrator)?(?:$|[.:/_ -])/.test(text)) return "admin";
    if (/installer|installateur|inbetriebnahme/.test(text)) return "installer";
    if (/endkunde|customer|smarthome|guest|gast|(?:^|\s)user(?:$|\s)/.test(text)) return "customer";
    return "unknown";
  }

  function roleFromGlobals() {
    const candidates = [
      window.__NEXOWATT_ROLE__, window.__EOS_ROLE__, window.eosRole,
      window.currentUser && window.currentUser.role,
      window.user && window.user.role,
      document.documentElement.getAttribute("data-role"),
      document.body && document.body.getAttribute("data-role")
    ];
    for (const value of candidates) {
      const role = classify(value);
      if (role !== "unknown") return role;
    }
    return "unknown";
  }

  function roleFromStorage() {
    const stores = [window.sessionStorage, window.localStorage];
    const keys = ["eos.role", "eosRole", "role", "userRole", "nexowatt.role", "auth.role", "currentRole"];
    for (const store of stores) {
      try {
        for (const key of keys) {
          const role = classify(store.getItem(key));
          if (role !== "unknown") return role;
        }
      } catch { /* storage can be disabled */ }
    }
    return "unknown";
  }

  function roleFromDom() {
    const selectors = [
      "[data-role]", "[data-user-role]", "[data-current-role]", "[aria-label*='Rolle' i]",
      "[aria-label*='role' i]", "header", "nav", ".MuiAppBar-root"
    ];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const value = [
          el.getAttribute && el.getAttribute("data-role"),
          el.getAttribute && el.getAttribute("data-user-role"),
          el.getAttribute && el.getAttribute("data-current-role"),
          el.getAttribute && el.getAttribute("aria-label"),
          el.textContent
        ].filter(Boolean).join(" ");
        const role = classify(value);
        if (role !== "unknown") return role;
      }
    }
    return "unknown";
  }

  function findDisplayedUser() {
    const candidates = document.querySelectorAll("header *, nav *, .MuiAppBar-root *");
    for (const el of candidates) {
      const text = normalize(el.textContent);
      if (!text || text.length > 80) continue;
      if (/\b(admin|installer|user|guest|gast|endkunde)\b/.test(text)) return text;
    }
    return "";
  }

  async function fetchSecurityStatus() {
    try {
      const user = encodeURIComponent(findDisplayedUser());
      const response = await fetch(`/api/nexowatt-eos/security/status?user=${user}&v=${VERSION}`, {
        credentials: "same-origin", cache: "no-store", headers: { "Accept": "application/json" }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  function isAdmin() { return state.role === "admin"; }
  function isCustomer() { return state.role === "customer"; }

  function hide(el, reason) {
    if (!el || el === document.body || el === document.documentElement) return;
    if (!el.hasAttribute(HIDDEN)) {
      el.setAttribute(HIDDEN, reason || "restricted");
      el.setAttribute("aria-hidden", "true");
      el.style.setProperty("display", "none", "important");
    }
  }

  function unhide(el) {
    if (!el || !el.hasAttribute(HIDDEN)) return;
    el.removeAttribute(HIDDEN);
    el.removeAttribute("aria-hidden");
    el.style.removeProperty("display");
  }

  function closestAction(el) {
    return el && el.closest && el.closest("a,button,[role='button'],[role='tab'],li,.MuiButtonBase-root") || el;
  }

  function includesAny(text, tokens) {
    return tokens.some(token => text.includes(token));
  }

  function applyNavigationPolicy() {
    const actions = document.querySelectorAll("a,button,[role='button'],[role='tab'],li,.MuiButtonBase-root");
    for (const raw of actions) {
      const el = closestAction(raw);
      const text = textOf(el);
      if (!text) continue;

      const adminOnly = includesAny(text, adminOnlyTokens) ||
        (/\badmin\b/.test(text) && /(?:8081|adapter=admin|io.?broker)/.test(text));
      const backup = includesAny(text, backupTokens);

      if (!isAdmin() && adminOnly) hide(el, "admin-only");
      else if (adminOnly) unhide(el);

      if (backup && state.backupActive === false) hide(el, "backup-inactive");
      else if (backup && state.backupActive === true && (isAdmin() || !adminOnly)) unhide(el);
    }

    if (!isAdmin()) {
      for (const el of document.querySelectorAll("[data-testid*='expert' i],[class*='expert' i],[id*='expert' i],[title*='Experten' i],[aria-label*='Experten' i],[title*='Expert' i],[aria-label*='Expert' i]")) {
        hide(closestAction(el), "admin-only-expert");
      }
    }
  }

  function isDataPointPage() {
    const route = normalize(location.pathname + " " + location.hash + " " + document.title);
    if (includesAny(route, dataPointTokens)) return true;
    const selected = document.querySelector("[aria-selected='true'],.Mui-selected,.active");
    return selected ? includesAny(textOf(selected), dataPointTokens) : false;
  }

  function makeDatapointsReadOnly() {
    const root = document.querySelector("main") || document.body;
    if (!isCustomer() || !isDataPointPage()) {
      root && root.removeAttribute(READONLY);
      return;
    }
    root.setAttribute(READONLY, "true");
    for (const el of root.querySelectorAll("input,textarea,select,[contenteditable='true'],button,[role='button']")) {
      const text = textOf(el);
      const isSearch = /filter|suche|search|refresh|aktualisieren|reload|sort|spalte|column|zurück|back/.test(text) ||
        /search/i.test(el.getAttribute && el.getAttribute("type") || "") ||
        /filter|search/i.test(el.getAttribute && el.getAttribute("placeholder") || "");
      const likelyWriter = includesAny(text, dangerousWriteTokens) ||
        /value|wert|write|edit|save|delete|setstate|state-value/i.test(text) ||
        (el.matches("input,textarea,select,[contenteditable='true']") && !isSearch);
      if (likelyWriter && !isSearch) {
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("tabindex", "-1");
        if ("disabled" in el) el.disabled = true;
        if (el.getAttribute("contenteditable") === "true") el.setAttribute("contenteditable", "false");
        el.style.setProperty("pointer-events", "none", "important");
        el.style.setProperty("opacity", "0.62", "important");
      }
    }
  }

  function currentRouteRestricted() {
    const route = normalize(location.pathname + " " + location.search + " " + location.hash);
    return includesAny(route, adminOnlyTokens);
  }

  function renderForbidden() {
    if (document.getElementById("eos-role-forbidden")) return;
    const overlay = document.createElement("div");
    overlay.id = "eos-role-forbidden";
    overlay.innerHTML = `<div class="eos-role-forbidden-card"><strong>Zugriff gesperrt</strong><span>App-Center, Lizenz, Simulation und Expertenmodus sind ausschließlich für Administratoren freigegeben.</span><button type="button">Zurück zum Cockpit</button></div>`;
    overlay.querySelector("button").addEventListener("click", () => {
      location.hash = "#/";
      try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function guardCurrentRoute() {
    if (!isAdmin() && currentRouteRestricted()) renderForbidden();
    else document.getElementById("eos-role-forbidden")?.remove();
  }

  function clearExpertMode() {
    if (isAdmin()) return;
    const keys = ["expertMode", "expert-mode", "eos.expert", "eosExpertMode", "adminExpertMode"];
    for (const store of [window.localStorage, window.sessionStorage]) {
      try { keys.forEach(key => store.removeItem(key)); } catch { /* ignore */ }
    }
    window.__NEXOWATT_EXPERT_MODE__ = false;
  }

  function scrubPrivilegedUiSessions() {
    if (isAdmin()) return;
    const marker = "eos.nonAdminUiLogout.v7104";
    try {
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");
    } catch { /* continue */ }
    const protocol = location.protocol === "https:" ? "https:" : "http:";
    const host = location.hostname;
    for (const port of [8082, 8188]) {
      const iframe = document.createElement("iframe");
      iframe.hidden = true;
      iframe.setAttribute("aria-hidden", "true");
      iframe.src = `${protocol}//${host}:${port}/logout?source=eos-role-security&v=${VERSION}`;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 12000);
    }
  }

  function apply() {
    state.appliedAt = Date.now();
    document.documentElement.setAttribute("data-eos-effective-role", state.role);
    applyNavigationPolicy();
    makeDatapointsReadOnly();
    clearExpertMode();
    guardCurrentRoute();
  }

  function installEventGuards() {
    document.addEventListener("click", event => {
      if (isAdmin()) return;
      const action = closestAction(event.target);
      const text = textOf(action);
      if (includesAny(text, adminOnlyTokens) || (/\badmin\b/.test(text) && /(?:8081|adapter=admin|io.?broker)/.test(text))) {
        event.preventDefault(); event.stopImmediatePropagation(); renderForbidden(); return;
      }
      if (isCustomer() && isDataPointPage() && includesAny(text, dangerousWriteTokens)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
    }, true);
    document.addEventListener("submit", event => {
      if (isCustomer() && isDataPointPage()) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    for (const name of ["pushState", "replaceState"]) {
      const original = history[name];
      history[name] = function(...args) {
        const result = original.apply(this, args);
        queueMicrotask(apply);
        return result;
      };
    }
    addEventListener("hashchange", apply);
    addEventListener("popstate", apply);
  }

  function injectStyles() {
    if (document.getElementById("eos-role-security-style")) return;
    const style = document.createElement("style");
    style.id = "eos-role-security-style";
    style.textContent = `
      [${HIDDEN}] { display:none !important; }
      #eos-role-forbidden { position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center; padding:24px; background:rgba(1,17,28,.96); color:#eefaff; font-family:Arial,sans-serif; }
      .eos-role-forbidden-card { width:min(620px,100%); display:grid; gap:18px; padding:30px; border:1px solid #16d49d; border-radius:18px; background:#072333; box-shadow:0 20px 80px rgba(0,0,0,.45); }
      .eos-role-forbidden-card strong { color:#24e6ad; font-size:28px; }
      .eos-role-forbidden-card span { line-height:1.55; }
      .eos-role-forbidden-card button { justify-self:start; padding:10px 18px; border:1px solid #16d49d; border-radius:10px; color:#021911; background:#24e6ad; font-weight:700; cursor:pointer; }
      [${READONLY}="true"]::before { content:"Nur-Lesezugriff für Endkunden"; position:sticky; top:0; z-index:10; display:block; margin:8px; padding:8px 12px; border:1px solid #1aa57d; border-radius:9px; background:#07342b; color:#cffff0; font:600 13px Arial,sans-serif; }
    `;
    document.head.appendChild(style);
  }

  async function init() {
    injectStyles();
    let role = roleFromGlobals();
    if (role === "unknown") role = roleFromStorage();
    if (role === "unknown") role = roleFromDom();
    const status = await fetchSecurityStatus();
    if (status) {
      const serverRole = classify(status.role);
      if (serverRole !== "unknown") role = serverRole;
      if (typeof status.backupActive === "boolean") state.backupActive = status.backupActive;
      state.user = status.user || "";
    }
    if (role === "unknown") role = "customer"; // least privilege until authenticated role is known
    state.role = role;
    try { sessionStorage.setItem("eos.role.effective", role); } catch { /* ignore */ }
    installEventGuards();
    apply();
    scrubPrivilegedUiSessions();
    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(apply, 40);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "href"] });
    setInterval(async () => {
      const refreshed = await fetchSecurityStatus();
      if (refreshed && typeof refreshed.backupActive === "boolean" && refreshed.backupActive !== state.backupActive) {
        state.backupActive = refreshed.backupActive; apply();
      }
    }, 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
