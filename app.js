/* AI Watchlist PWA */
const STORAGE_KEY = "ai_watchlist_csv";
const SHEET_URL_KEY = "ai_watchlist_sheet_url";

// Install prompt handling
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

const els = {
  search: document.getElementById('search'),
  category: document.getElementById('categoryFilter'),
  country: document.getElementById('countryFilter'),
  filePicker: document.getElementById('filePicker'),
  sheetUrl: document.getElementById('sheetUrl'),
  loadSheet: document.getElementById('loadSheet'),
  clearData: document.getElementById('clearData'),
  tableWrap: document.getElementById('tableWrap'),
  summary: document.getElementById('summary')
};

let rows = [];

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=> (''+a).localeCompare(b));
}

function renderSummary(data) {
  const total = data.length;
  const cats = uniqueSorted(data.map(r=>r['Category']));
  els.summary.innerHTML = `<div class="small">${total} entries • ${cats.length} categories</div>`;
}

function renderTable(data) {
  if (!data || !data.length) { els.tableWrap.innerHTML = ""; renderSummary([]); return; }
  renderSummary(data);
  const header = `
    <thead><tr>
      <th>Ticker</th><th>Name</th><th>Category</th>
      <th>Thesis</th><th>Catalysts</th><th>Risks</th><th>HQ</th>
    </tr></thead>`;
  const body = data.map(r=>`
    <tr>
      <td class="ticker">${r['Ticker']||''}</td>
      <td class="name">${r['Name']||''}</td>
      <td><span class="tag">${r['Category']||''}</span></td>
      <td class="thesis">${r['Thesis (1-liner)']||''}</td>
      <td class="small">${r['Key Catalysts']||''}</td>
      <td class="small">${r['Risks']||''}</td>
      <td class="small">${r['HQ Country']||''}</td>
    </tr>`).join("");
  els.tableWrap.innerHTML = `<table>${header}<tbody>${body}</tbody></table>`;
}

function applyFilters() {
  const q = (els.search.value || "").toLowerCase();
  const cat = els.category.value || "";
  const ctry = els.country.value || "";
  const filtered = rows.filter(r=>{
    const hay = Object.values(r).join(" ").toLowerCase();
    const okQ = !q || hay.includes(q);
    const okC = !cat || r['Category']===cat;
    const okT = !ctry || r['HQ Country']===ctry;
    return okQ && okC && okT;
  });
  renderTable(filtered);
}

function populateFilters() {
  const cats = uniqueSorted(rows.map(r=>r['Category']));
  const ctrs = uniqueSorted(rows.map(r=>r['HQ Country']));

  els.category.innerHTML = `<option value="">All Categories</option>` + cats.map(c=>`<option>${c}</option>`).join("");
  els.country.innerHTML = `<option value="">All Countries</option>` + ctrs.map(c=>`<option>${c}</option>`).join("");
}

function parseCSV(text) {
  return new Promise((resolve, reject)=>{
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res)=> resolve(res.data),
      error: reject
    });
  });
}

async function loadFromText(text, cache=true) {
  const data = await parseCSV(text);
  rows = data;
  if (cache) localStorage.setItem(STORAGE_KEY, text);
  populateFilters();
  applyFilters();
}

async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed');
  return await res.text();
}

// Events
els.search.addEventListener('input', applyFilters);
els.category.addEventListener('change', applyFilters);
els.country.addEventListener('change', applyFilters);

els.filePicker.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  await loadFromText(text, true);
});

els.loadSheet.addEventListener('click', async ()=>{
  const url = els.sheetUrl.value.trim();
  if (!url) return alert("Paste a Google Sheet CSV URL");
  try {
    const text = await fetchSheet(url);
    localStorage.setItem(SHEET_URL_KEY, url);
    await loadFromText(text, true);
  } catch (e) {
    alert("Couldn't load that URL. Make sure it's a public CSV link.");
  }
});

els.clearData.addEventListener('click', ()=>{
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SHEET_URL_KEY);
  rows = [];
  populateFilters();
  renderTable([]);
  alert("Cleared cached data.");
});

// Boot: try cache first, else load fallback sample
(async function boot(){
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    await loadFromText(cached, false);
    const url = localStorage.getItem(SHEET_URL_KEY);
    if (url) { // refresh in background
      fetchSheet(url).then(t=>loadFromText(t,true)).catch(()=>{});
    }
  } else {
    // Minimal sample so UI isn't empty
    const sample = `Ticker,Name,Category,Thesis (1-liner),Key Catalysts,Risks,HQ Country
PLTR,Palantir,Software—AI Platforms/Apps,Expanding AIP adoption (gov + commercial),AIP contracts; NRR>120%; margins,Pricing vs hyperscalers; overlap,USA
CRDO,Credo,Infra—Connectivity/SerDes,SerDes/AECs for 800G→1.6T,Hyperscaler orders; 1.6T ramps,Concentration; competition,USA`;
    await loadFromText(sample, false);
  }
})();