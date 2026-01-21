// sidebar.js — Mode 1 (stable)
// Sends settings in the shape content.js expects (including 14 cases)

const statusEl = document.getElementById("status-bar");

const UI = {
  master: "chk-master",

  // POS
  noun: "chk-noun",
  verb: "chk-verb",
  adj: "chk-adj",
  adv: "chk-adv",
  pron: "chk-pron",
  adp: "chk-adp",
  conj: "chk-conj",
  num: "chk-num",

  // CASES (14)
  nom: "chk-nom",
  gen: "chk-gen",
  par: "chk-par",
  ill: "chk-ill",
  ine: "chk-ine",
  ela: "chk-ela",
  all: "chk-all",
  ade: "chk-ade",
  abl: "chk-abl",
  tra: "chk-tra",
  ter: "chk-ter",
  ess: "chk-ess",
  abe: "chk-abe",
  kom: "chk-kom",

  // Forms (optional)
  number: "chk-number",
  v_ma: "chk-v-ma",
  v_da: "chk-v-da",
  v_part: "chk-v-part",

  resetBtn: "btn-reset",
};

// Calm defaults
const DEFAULT_SETTINGS = {
  noun: true,
  verb: true,
  adj: true,
  adv: true,

  pron: false,
  adp: false,
  conj: false,
  num: false,

  // cases (14)
  nom: true,
  gen: false,
  par: false,
  ill: false,
  ine: false,
  ela: false,
  all: false,
  ade: false,
  abl: false,
  tra: false,
  ter: false,
  ess: false,
  abe: false,
  kom: false,

  // forms
  number: false,
  v_ma: false,
  v_da: false,
  v_part: false,

  // misc
  negation: true,
};

let isMasterOn = false;
let settings = { ...DEFAULT_SETTINGS };

function updateStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.style.display = "block";
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

function setCheckbox(id, value) {
  const el = document.getElementById(id);
  if (el && el.type === "checkbox") el.checked = !!value;
}

function getCheckbox(id) {
  const el = document.getElementById(id);
  if (el && el.type === "checkbox") return !!el.checked;
  return null;
}

async function getActiveTabId() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0]?.id ?? null;
}

async function sendToActiveTab(payload) {
  const tabId = await getActiveTabId();
  if (!tabId) return;

  try {
    await browser.tabs.sendMessage(tabId, payload);
  } catch (e) {
    updateStatus("This page cannot be analyzed (try a normal website tab).", true);
  }
}

function applySettingsToUI() {
  setCheckbox(UI.master, isMasterOn);

  for (const k of ["noun","verb","adj","adv","pron","adp","conj","num"]) {
    if (UI[k]) setCheckbox(UI[k], settings[k]);
  }

  for (const c of ["nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"]) {
    if (UI[c]) setCheckbox(UI[c], settings[c]);
  }

  for (const k of ["number","v_ma","v_da","v_part"]) {
    if (UI[k]) setCheckbox(UI[k], settings[k]);
  }
}

function readUIIntoSettings() {
  for (const k of ["noun","verb","adj","adv","pron","adp","conj","num"]) {
    const v = getCheckbox(UI[k]);
    if (v !== null) settings[k] = v;
  }

  for (const c of ["nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"]) {
    const v = getCheckbox(UI[c]);
    if (v !== null) settings[c] = v;
  }

  for (const k of ["number","v_ma","v_da","v_part"]) {
    const v = getCheckbox(UI[k]);
    if (v !== null) settings[k] = v;
  }
}

function buildContentSettingsPayload() {
  return {
    // POS
    noun: settings.noun,
    verb: settings.verb,
    adj: settings.adj,
    adv: settings.adv,
    pron: settings.pron,
    adp: settings.adp,
    conj: settings.conj,
    num: settings.num,

    // cases (14)
    nom: settings.nom,
    gen: settings.gen,
    par: settings.par,
    ill: settings.ill,
    ine: settings.ine,
    ela: settings.ela,
    all: settings.all,
    ade: settings.ade,
    abl: settings.abl,
    tra: settings.tra,
    ter: settings.ter,
    ess: settings.ess,
    abe: settings.abe,
    kom: settings.kom,

    // forms
    number: settings.number,
    v_ma: settings.v_ma,
    v_da: settings.v_da,
    v_part: settings.v_part,

    // misc
    negation: settings.negation,
  };
}

async function onMasterChanged(checked) {
  isMasterOn = !!checked;
  applySettingsToUI();

  if (isMasterOn) {
    updateStatus("ON — scanning…");
    await sendToActiveTab({
      action: "ANALYZE_PAGE",
      settings: buildContentSettingsPayload(),
    });
  } else {
    updateStatus("OFF — highlights removed.");
    await sendToActiveTab({ action: "STOP_ANALYSIS" });
  }
}

async function onAnySettingChanged() {
  readUIIntoSettings();

  if (!isMasterOn) {
    updateStatus("OFF — settings saved.");
    return;
  }

  await sendToActiveTab({
    action: "UPDATE_VISUALS",
    settings: buildContentSettingsPayload(),
  });
}

async function onResetClicked() {
  settings = { ...DEFAULT_SETTINGS };
  applySettingsToUI();

  if (!isMasterOn) {
    updateStatus("Reset to calm defaults.");
    return;
  }

  await sendToActiveTab({
    action: "UPDATE_VISUALS",
    settings: buildContentSettingsPayload(),
  });

  updateStatus("Reset ✅");
}

function bindCheckbox(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", onAnySettingChanged);
}

(function init() {
  applySettingsToUI();
  updateStatus("Ready");

  // master switch
  const masterEl = document.getElementById(UI.master);
  if (masterEl) {
    masterEl.addEventListener("change", (e) => onMasterChanged(e.target.checked));
  }

  // bind all toggles
  for (const k of ["noun","verb","adj","adv","pron","adp","conj","num"]) bindCheckbox(UI[k]);
  for (const c of ["nom","gen","par","ill","ine","ela","all","ade","abl","tra","ter","ess","abe","kom"]) bindCheckbox(UI[c]);
  for (const k of ["number","v_ma","v_da","v_part"]) bindCheckbox(UI[k]);

  // reset
  const resetBtn = document.getElementById(UI.resetBtn);
  if (resetBtn) resetBtn.addEventListener("click", onResetClicked);

  // Receive status updates from content.js
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.action === "STATUS_UPDATE") {
      updateStatus(msg.text || "", !!msg.error);
    }
  });
})();