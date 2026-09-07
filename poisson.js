/* ============================================================
   poisson.js — Beklenen gol modeli
   ============================================================
   Ayni mantik: takim hucum/savunma katsayilari -> beklenen gol (lambda)
   -> Poisson dagilimiyla pazar olasiliklari (1.5 Ust, 2.5 Ust, KG Var).
   Ek olarak: son-N mac formundan "WWDLW" gibi bir form string'i ve
   basit bir "tahmini skor" (en olasi skor karesi) hesaplanir.
*/

function poissonPmf(k, lam){
  if(lam<=0) return k===0 ? 1 : 0;
  let fact = 1; for(let i=2;i<=k;i++) fact*=i;
  return Math.exp(-lam) * Math.pow(lam,k) / fact;
}
function poissonCdf(k, lam){
  let s=0; for(let i=0;i<=k;i++) s+=poissonPmf(i,lam);
  return s;
}

function computeLeagueBaseline(history){
  const home=[], away=[];
  history.forEach(r=>{
    if(isNaN(r.attigi)) return;
    if(r.saha==='Ev') home.push(r.attigi);
    else if(r.saha==='Deplasman') away.push(r.attigi);
  });
  const avg=(arr,d)=> arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : d;
  return { avgHome: avg(home,1.45), avgAway: avg(away,1.15) };
}

function computeTeamStrengths(history, baseline){
  const byTeam = {};
  history.forEach(r=>{
    if(!r.takim) return;
    (byTeam[r.takim] = byTeam[r.takim]||[]).push(r);
  });
  const strengths = {};
  Object.keys(byTeam).forEach(team=>{
    // en yeni mac sonda olacak sekilde tarih siralama (varsa)
    const rows = byTeam[team].slice().sort((a,b)=> (a.tarih||'').localeCompare(b.tarih||''));
    const ev = rows.filter(r=>r.saha==='Ev');
    const dep = rows.filter(r=>r.saha==='Deplasman');
    const avg=(arr,key)=>{
      const vals = arr.map(r=>r[key]).filter(v=>!isNaN(v));
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    };
    const attackHome=avg(ev,'attigi'), defenseHome=avg(ev,'yedigi');
    const attackAway=avg(dep,'attigi'), defenseAway=avg(dep,'yedigi');

    // Form string: son 5 mac (W/D/L), en son mac en sagda
    const last5 = rows.slice(-5);
    const form = last5.map(r=>{
      if(r.attigi>r.yedigi) return 'W';
      if(r.attigi<r.yedigi) return 'L';
      return 'D';
    }).join('');

    strengths[team] = {
      attackHome: attackHome!==null ? attackHome/baseline.avgHome : 1,
      defenseHome: defenseHome!==null ? defenseHome/baseline.avgAway : 1,
      attackAway: attackAway!==null ? attackAway/baseline.avgAway : 1,
      defenseAway: defenseAway!==null ? defenseAway/baseline.avgHome : 1,
      sampleSize: rows.length,
      avgScoredHome: attackHome, avgScoredAway: attackAway,
      form,
    };
  });
  return strengths;
}

function mostLikelyScore(lambdaHome, lambdaAway, maxGoals=6){
  let best = {h:0,a:0,p:0};
  for(let h=0;h<=maxGoals;h++){
    for(let a=0;a<=maxGoals;a++){
      const p = poissonPmf(h,lambdaHome)*poissonPmf(a,lambdaAway);
      if(p>best.p) best = {h,a,p};
    }
  }
  return best;
}

function projectFixture(ev, dep, strengths, baseline){
  const dEv = {attackHome:1,defenseHome:1,attackAway:1,defenseAway:1,sampleSize:0,form:'',avgScoredHome:null,avgScoredAway:null};
  const sHome = strengths[ev] || dEv;
  const sAway = strengths[dep] || dEv;

  const lambdaHome = sHome.attackHome * sAway.defenseAway * baseline.avgHome;
  const lambdaAway = sAway.attackAway * sHome.defenseHome * baseline.avgAway;
  const lambdaTotal = lambdaHome + lambdaAway;

  const pOver15 = 1 - poissonCdf(1, lambdaTotal);
  const pOver25 = 1 - poissonCdf(2, lambdaTotal);
  const pNoHome = Math.exp(-lambdaHome);
  const pNoAway = Math.exp(-lambdaAway);
  const pBtts = (1-pNoHome)*(1-pNoAway);

  const minSample = Math.min(sHome.sampleSize, sAway.sampleSize);
  let guven, guvenScore;
  if(minSample===0){ guven='VERI YOK'; guvenScore=0; }
  else if(minSample<5){ guven=`DUSUK GUVEN (${minSample} mac)`; guvenScore=45; }
  else if(minSample<10){ guven=`ORTA GUVEN (${minSample} mac)`; guvenScore=70; }
  else { guven=`YETERLI VERI (${minSample} mac)`; guvenScore=88; }

  const score = mostLikelyScore(lambdaHome, lambdaAway);

  return {
    evTakim:ev, depTakim:dep,
    lambdaHome: round2(lambdaHome), lambdaAway: round2(lambdaAway), lambdaTotal: round2(lambdaTotal),
    pOver15, pOver25, pBtts,
    guven, guvenScore, noData: minSample===0,
    tahminiSkor: `${score.h}-${score.a}`,
    evForm: sHome.form, depForm: sAway.form,
    evGolOrt: sHome.avgScoredHome, depGolOrt: sAway.avgScoredAway,
  };
}

function round2(n){ return Math.round(n*100)/100; }
