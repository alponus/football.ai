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
