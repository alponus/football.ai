/* ============================================================
   statistics.js — Gecmis performans analizi
   ============================================================
   getLoggedResults() icindeki her kayit su sekli izler:
   { tarih, mac, pazar, oran, sonuc: 'dogru'|'yanlis', stake: 1 }
   Bu kayitlar History sayfasindaki "Sonuc gir" formundan eklenir -
   sistem gercek mac sonuclarini otomatik ogrenemez, sen isaretlersin.
*/

function computeStatistics(){
  const results = getLoggedResults();
  const total = results.length;
  const correct = results.filter(r=>r.sonuc==='dogru').length;
  const wrong = total - correct;
  const successRate = total>0 ? correct/total : 0;

  // ROI: her kayitta stake birimi uzerinden (oran-1) kazanc ya da -1 kayip
  let netProfit = 0, totalStake = 0;
  results.forEach(r=>{
    const stake = r.stake || 1;
    totalStake += stake;
    if(r.sonuc==='dogru') netProfit += stake*(r.oran-1);
    else netProfit -= stake;
  });
  const roi = totalStake>0 ? netProfit/totalStake : 0;

  // Market kirilimi
  const byMarket = {};
  results.forEach(r=>{
    if(!byMarket[r.pazar]) byMarket[r.pazar] = {correct:0, total:0};
    byMarket[r.pazar].total++;
    if(r.sonuc==='dogru') byMarket[r.pazar].correct++;
  });
  const marketRates = Object.keys(byMarket).map(m=>({
    market:m, rate: byMarket[m].correct/byMarket[m].total, total: byMarket[m].total,
  })).sort((a,b)=>b.rate-a.rate);

  return {
    total, correct, wrong, successRate, roi, netProfit,
    bestMarket: marketRates[0] || null,
    worstMarket: marketRates.length>1 ? marketRates[marketRates.length-1] : null,
    marketRates,
  };
}

/**
 * Lig bazinda basari orani (madde 12: "en basarili/basarisiz lig").
 * Eski (manuel girilmis, lig bilgisi olmayan) kayitlar "Bilinmiyor"
 * altinda toplanir, hesaplama disi birakilmaz.
 */
function computeLeagueBreakdown(){
  const results = getLoggedResults();
  const byLeague = {};
  results.forEach(r=>{
    const lig = r.lig || 'Bilinmiyor';
    if(!byLeague[lig]) byLeague[lig] = {correct:0, total:0};
    byLeague[lig].total++;
    if(r.sonuc==='dogru') byLeague[lig].correct++;
  });
  return Object.keys(byLeague).map(lig=>({
    lig, correct: byLeague[lig].correct, total: byLeague[lig].total,
    rate: byLeague[lig].correct/byLeague[lig].total,
  })).sort((a,b)=>b.rate-a.rate);
}

/**
 * Guven puani vs gercek basari karsilastirmasi (madde 12).
 * guvenScore bilgisi olmayan (eski manuel) kayitlar bu hesaba dahil
 * edilmez - yanlis kalibrasyon sonucu vermemek icin.
 */
function computeConfidenceCalibration(){
  const results = getLoggedResults().filter(r=>typeof r.guvenScore === 'number');
  const bands = [
    {label:'0-50 (Düşük)', min:0, max:50},
    {label:'50-70 (Orta)', min:50, max:70},
    {label:'70-85 (İyi)', min:70, max:85},
    {label:'85-100 (Yüksek)', min:85, max:101},
  ];
  return bands.map(b=>{
    const grup = results.filter(r=>r.guvenScore>=b.min && r.guvenScore<b.max);
    const correct = grup.filter(r=>r.sonuc==='dogru').length;
    return {
      band: b.label, total: grup.length, correct,
      gercekOran: grup.length>0 ? correct/grup.length : null,
    };
  }).filter(b=>b.total>0);
}
