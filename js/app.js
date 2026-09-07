/* ============================================================
   app.js — Ortak sayfa iskeleti ve yardimcilar
   ============================================================ */

const NAV_ITEMS = [
  {key:'dashboard', href:'index.html', label:'Dashboard'},
  {key:'coupons', href:'coupons.html', label:'Kuponlar'},
  {key:'analysis', href:'analysis.html', label:'Maç Analizi'},
  {key:'history', href:'history.html', label:'İstatistik & Geçmiş'},
  {key:'settings', href:'settings.html', label:'Ayarlar'},
];

function renderSidebar(activeKey){
  const items = NAV_ITEMS.map(it=>
    `<a class="nav-item ${it.key===activeKey?'active':''}" href="${it.href}">${it.label}</a>`
  ).join('');
  return `
  <div class="sidebar">
    <div class="brand">FOOTBALL AI <span class="dot">PRO</span></div>
    ${items}
  </div>`;
}

function initShell(activeKey){
  applyTheme();
  document.getElementById('sidebar-slot').innerHTML = renderSidebar(activeKey);
}

/* WhatsApp: resmi ucretsiz API yok. wa.me linki WhatsApp'i mesaj hazir
   halde acar, gonder tusuna sen basarsin (tek tik, tam otomatik degil). */
function buildWhatsAppLink(text, phone){
  const encoded = encodeURIComponent(text);
  const base = phone ? `https://wa.me/${phone.replace(/\D/g,'')}` : 'https://wa.me/';
  return `${base}?text=${encoded}`;
}

function sendToWhatsApp(text){
  const settings = getSettings();
  const link = buildWhatsAppLink(text, settings.whatsappNumber);
  window.open(link, '_blank');
}

function printReport(){
  window.print();
}

/* Basit ilerleme animasyonu — "Analiz Et" basildiginda gorsel geri bildirim */
function runProgressSequence(steps, container, onDone){
  container.innerHTML = steps.map((s,i)=>`
    <div class="progress-wrap" data-step="${i}">
      <div class="progress-label"><span>${s}</span><span class="pct">0%</span></div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>`).join('');

  let i = 0;
  function nextStep(){
    if(i>=steps.length){ onDone(); return; }
    const wrap = container.querySelector(`[data-step="${i}"]`);
    const fill = wrap.querySelector('.progress-fill');
    const pct = wrap.querySelector('.pct');
    let p = 0;
    const iv = setInterval(()=>{
      p += 20 + Math.random()*20;
      if(p>=100){ p=100; clearInterval(iv); fill.style.width='100%'; pct.textContent='100%';
        i++; setTimeout(nextStep, 120); return; }
      fill.style.width = p+'%'; pct.textContent = Math.round(p)+'%';
    }, 90);
  }
  nextStep();
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
