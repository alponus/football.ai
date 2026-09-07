/* ============================================================
   storage.js — localStorage sarmalayicisi
   ============================================================
   Not: Bu proje tamamen yerel (client-side) calisir; sunucu yoktur.
   Butun veri, taraycinin localStorage'inda saklanir. Ayni tarayicida
   ac (ayni bilgisayarda, ayni tarayici) her zaman verine ulasirsin;
   baska bir bilgisayarda ac veri gormezsin (JSON disa aktarma ile
   tasiyabilirsin, bkz. Ayarlar sayfasi).
*/

const STORE_KEYS = {
  settings: 'fai_settings',
  history: 'fai_team_history',
  fixturesText: 'fai_fixtures_text',
  historyText: 'fai_history_text',
  lastAnalysis: 'fai_last_analysis',
  reports: 'fai_reports',          // {dateKey: reportSummaryObject}
  loggedResults: 'fai_logged_results', // gecmis kupon/bacak sonuclarinin gercek cikan sonucu
  theme: 'fai_theme',
};

const DEFAULT_SETTINGS = {
  minEdge: 0.05,
  minGuvenScore: 45,
  minOdds: 1.30,
  maxOdds: 2.20,
  targetMin: 4.5,
  targetMax: 6.5,
  maxLegs: 4,
  kuponSayisi: 5,
  whatsappNumber: '',
};

function fai_get(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){
    console.error('storage get error', key, e);
    return fallback;
  }
}
function fai_set(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }catch(e){
    console.error('storage set error', key, e);
    return false;
  }
}

function getSettings(){ return Object.assign({}, DEFAULT_SETTINGS, fai_get(STORE_KEYS.settings, {})); }
function saveSettings(s){ return fai_set(STORE_KEYS.settings, s); }

function getTeamHistory(){ return fai_get(STORE_KEYS.history, []); }
function saveTeamHistory(h){ return fai_set(STORE_KEYS.history, h); }

function getLastAnalysis(){ return fai_get(STORE_KEYS.lastAnalysis, null); }
function saveLastAnalysis(a){ return fai_set(STORE_KEYS.lastAnalysis, a); }

function getReports(){ return fai_get(STORE_KEYS.reports, {}); }
function saveReport(dateKey, summary){
  const reports = getReports();
  reports[dateKey] = summary;
  fai_set(STORE_KEYS.reports, reports);
}

function getLoggedResults(){ return fai_get(STORE_KEYS.loggedResults, []); }
function addLoggedResult(entry){
  const list = getLoggedResults();
  list.push(entry);
  fai_set(STORE_KEYS.loggedResults, list);
}

function applyTheme(){
  const theme = fai_get(STORE_KEYS.theme, 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
function toggleTheme(){
  const cur = fai_get(STORE_KEYS.theme, 'dark');
  const next = cur==='dark' ? 'light' : 'dark';
  fai_set(STORE_KEYS.theme, next);
  document.documentElement.setAttribute('data-theme', next);
  return next;
}

function todayKey(){
  const d = new Date();
  const pad = n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}

/* -------- Dosya indirme yardimcilari (Not Defteri / JSON) -------- */
function downloadTextFile(filename, content, mime='text/plain'){
  const blob = new Blob([content], {type: mime+';charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
