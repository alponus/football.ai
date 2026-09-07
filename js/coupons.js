/* ============================================================
   coupons.js — Kupon kombinasyon motoru
   ============================================================ */

function combinations(arr, r){
  const results = [];
  function helper(start, combo){
    if(combo.length===r){ results.push(combo.slice()); return; }
    for(let i=start;i<arr.length;i++){
      combo.push(arr[i]);
      helper(i+1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

/**
 * settings: { minEdge, minGuvenScore, minOdds, maxOdds, targetMin, targetMax, maxLegs, kuponSayisi }
 */
function buildCoupons(legs, settings){
  const candidates = legs.filter(l=>
    !l.noData &&
    l.edge >= settings.minEdge &&
    l.guvenScore >= settings.minGuvenScore &&
    l.odds >= settings.minOdds &&
    l.odds <= settings.maxOdds
  ).sort((a,b)=>b.edge-a.edge);

  if(candidates.length===0) return [];

  let allCombos = [];
  const maxLegs = Math.min(settings.maxLegs || 4, candidates.length);
  for(let r=1;r<=maxLegs;r++){
    combinations(candidates, r).forEach(combo=>{
      const macs = combo.map(c=>c.mac);
      if(new Set(macs).size !== macs.length) return;
      const totalOdds = combo.reduce((p,c)=>p*c.odds, 1);
      if(totalOdds>=settings.targetMin && totalOdds<=settings.targetMax){
        const avgEdge = combo.reduce((s,c)=>s+c.edge,0)/combo.length;
        const avgGuven = combo.reduce((s,c)=>s+c.guvenScore,0)/combo.length;
        const combinedProb = combo.reduce((p,c)=>p*c.modelProb, 1);
        const stars = Math.round(Math.min(5, Math.max(0,
          (Math.min(1, avgEdge/0.15))*0.5*5 + (avgGuven/100)*0.5*5
        )));
        let risk;
        if(combo.length<=1) risk='Düşük';
        else if(combo.length<=2 && avgEdge>=0.08) risk='Düşük';
        else if(combo.length<=3 && avgEdge>=0.05) risk='Orta';
        else risk='Yüksek';

        allCombos.push({
          legs: combo, totalOdds: round2(totalOdds), avgEdge, avgGuven,
          basariTahmini: combinedProb, stars, risk,
        });
      }
    });
  }

  allCombos.sort((a,b)=> (b.stars-a.stars) || (b.avgEdge-a.avgEdge));

  const final = [];
  const usedSets = [];
  for(const c of allCombos){
    const matchSet = new Set(c.legs.map(l=>l.mac));
    const dup = usedSets.some(u => u.size===matchSet.size && [...u].every(m=>matchSet.has(m)));
    if(dup) continue;
    final.push(c);
    usedSets.push(matchSet);
    if(final.length >= (settings.kuponSayisi || 5)) break;
  }
  return final;
}

function round2(n){ return Math.round(n*100)/100; }
