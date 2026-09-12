/* ============================================================
   apiAdapter.js — API verisini mevcut motora baglar
   ============================================================
   Amac: /api/* uclarindan gelen ham veriyi, poisson.js'nin uzun
   zamandir calisan projectFixture() ciktisiyla AYNI sekle sokmak.
   Boylece renderResults(), evaluateLeg(), buildCoupons() gibi
   test edilmis fonksiyonlar hic degismeden calismaya devam eder.
*/

/**
 * Siniri (limit) asilmadan cok sayida istegi paralel yurutur.
 * items: islenecek ogeler
 * limit: ayni anda kac istegin gidecegi
 * fn: async (item) => sonuc
 * onProgress: (tamamlanan, toplam) => void
 */
async function concurrencyMap(items, limit, fn, onProgress){
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(){
    while(nextIndex < items.length){
      const i = nextIndex++;
      try{
        results[i] = await fn(items[i], i);
      }catch(e){
        results[i] = null;
      }
      completed++;
      if(onProgress) onProgress(completed, items.length);
    }
  }

  const workers = Array.from({length: Math.min(limit, items.length)}, worker);
  await Promise.all(workers);
  return results;
}

/**
 * API-Football /teams/statistics cevabindan (tek bir takimin tek
 * lig/sezon icin istatistigi) beklenen gol modeli icin gerekli
 * HAM sayilari cikarir. Herhangi bir kucultme/ayarlama BURADA
 * yapilmaz - o islem asagidaki buildAdjustedProfile()'da, lig
 * onseli ve form bilgisi elde olduktan SONRA yapilir.
 */
function extractTeamGoalProfile(statsResp){
  if(!statsResp) return null;
  const g = statsResp.goals;
  if(!g) return null;

  const toNum = v => (v===null || v===undefined || v==='') ? null : parseFloat(v);

  return {
    forHome: toNum(g.for?.average?.home),
    forAway: toNum(g.for?.average?.away),
    againstHome: toNum(g.against?.average?.home),
    againstAway: toNum(g.against?.average?.away),
    playedHome: statsResp.fixtures?.played?.home ?? 0,
    playedAway: statsResp.fixtures?.played?.away ?? 0,
    form: statsResp.form || '',
  };
}

const GLOBAL_PRIOR = { forHome: 1.45, forAway: 1.15, againstHome: 1.15, againstAway: 1.45 };
const SHRINKAGE_K = 6; // ~6 mac sonrasi gercek veriye %50+ agirlik verilir

/**
 * Bugun cekilen TUM takimlarin ham profillerinden, HER LIG icin o
 * ligin kendi ev/deplasman gol ortalamasini (onsel deger) hesaplar.
 * Neden onemli: her ligde ev sahibi avantaji ayni degildir - sabit
 * bir global sayi yerine, o gun o ligde oynayan takimlarin gercek
 * ortalamasini kullanmak cok daha dogru bir "normal" tanimlar.
 * Yeterli takim (>=3) yoksa lig icin global degere geri doner.
 */
function computeLeaguePriors(profilesByKey, keyToLeague){
  const byLeague = {};
  Object.keys(profilesByKey).forEach(key=>{
    const profile = profilesByKey[key];
    const leagueId = keyToLeague[key];
    if(!profile || leagueId===undefined) return;
    if(!byLeague[leagueId]) byLeague[leagueId] = {forHome:[], forAway:[], againstHome:[], againstAway:[]};
    if(profile.playedHome>=3 && profile.forHome!==null) byLeague[leagueId].forHome.push(profile.forHome);
    if(profile.playedAway>=3 && profile.forAway!==null) byLeague[leagueId].forAway.push(profile.forAway);
    if(profile.playedHome>=3 && profile.againstHome!==null) byLeague[leagueId].againstHome.push(profile.againstHome);
    if(profile.playedAway>=3 && profile.againstAway!==null) byLeague[leagueId].againstAway.push(profile.againstAway);
  });

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const priors = new Map();
  Object.keys(byLeague).forEach(leagueId=>{
    const b = byLeague[leagueId];
    const yeterliTakim = b.forHome.length>=3 && b.forAway.length>=3;
    priors.set(leagueId, yeterliTakim ? {
      forHome: avg(b.forHome) ?? GLOBAL_PRIOR.forHome,
      forAway: avg(b.forAway) ?? GLOBAL_PRIOR.forAway,
      againstHome: avg(b.againstHome) ?? GLOBAL_PRIOR.againstHome,
      againstAway: avg(b.againstAway) ?? GLOBAL_PRIOR.againstAway,
      kaynak: `${leagueId} ligi ortalaması (${b.forHome.length} takım)`,
    } : { ...GLOBAL_PRIOR, kaynak: 'genel varsayılan (bu ligde yeterli örnek yok)' });
  });
  return priors;
}

function shrink(rawValue, n, priorValue){
  if(rawValue===null) return priorValue;
  return (rawValue*n + priorValue*SHRINKAGE_K) / (n + SHRINKAGE_K);
}

/**
 * Son N mactan (herhangi bir rakibe karsi, ev/deplasman ayrimi
 * yapilmadan) basit bir "guncel form" olcusu cikarir: attigi ve
 * yedigi gol ortalamasi. Ev/deplasman ayrimi yapmiyoruz cunku son
 * 8 mac icinde bir tarafin ornegi cok kucuk kalip gurultulu olurdu.
 */
function extractRecentForm(recentFixturesResp, teamId){
  if(!recentFixturesResp || recentFixturesResp.length===0) return null;
  const bitenler = recentFixturesResp.filter(m=>
    ['FT','AET','PEN'].includes(m.fixture?.status?.short) &&
    m.goals && m.goals.home!==null && m.goals.away!==null
  );
  if(bitenler.length===0) return null;

  let toplamAtilan=0, toplamYenen=0;
  bitenler.forEach(m=>{
    const evMi = m.teams.home.id===teamId;
    toplamAtilan += evMi ? m.goals.home : m.goals.away;
    toplamYenen += evMi ? m.goals.away : m.goals.home;
  });
  return { avgFor: toplamAtilan/bitenler.length, avgAgainst: toplamYenen/bitenler.length, n: bitenler.length };
}

/**
 * NIHAI profili uretir: once lig onseline dogru KUCULTME (az veri
 * varsa), sonra GUNCEL FORM ile hafif carpimsal AYARLAMA (varsa).
 * Ikisi de ornek buyuklugune gore olceklenir - kucuk ornek asla
 * modelin tamamini ele gecirmez.
 */
function buildAdjustedProfile(rawProfile, leaguePrior, recentForm){
  if(!rawProfile) return null;
  const prior = leaguePrior || GLOBAL_PRIOR;

  let forHome = shrink(rawProfile.forHome, rawProfile.playedHome, prior.forHome);
  let forAway = shrink(rawProfile.forAway, rawProfile.playedAway, prior.forAway);
  let againstHome = shrink(rawProfile.againstHome, rawProfile.playedHome, prior.againstHome);
  let againstAway = shrink(rawProfile.againstAway, rawProfile.playedAway, prior.againstAway);

  if(recentForm && recentForm.n>=3){
    const seasonOverallFor = ((rawProfile.forHome??prior.forHome)*rawProfile.playedHome + (rawProfile.forAway??prior.forAway)*rawProfile.playedAway) / Math.max(1, rawProfile.playedHome+rawProfile.playedAway);
    const seasonOverallAgainst = ((rawProfile.againstHome??prior.againstHome)*rawProfile.playedHome + (rawProfile.againstAway??prior.againstAway)*rawProfile.playedAway) / Math.max(1, rawProfile.playedHome+rawProfile.playedAway);

    const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const attackFormFactor = seasonOverallFor>0 ? clamp(recentForm.avgFor/seasonOverallFor, 0.6, 1.6) : 1;
    const defenseFormFactor = seasonOverallAgainst>0 ? clamp(recentForm.avgAgainst/seasonOverallAgainst, 0.6, 1.6) : 1;

    const formWeight = Math.min(0.35, recentForm.n/15);
    forHome *= (1 + formWeight*(attackFormFactor-1));
    forAway *= (1 + formWeight*(attackFormFactor-1));
    againstHome *= (1 + formWeight*(defenseFormFactor-1));
    againstAway *= (1 + formWeight*(defenseFormFactor-1));
  }

  return {
    forHome, forAway, againstHome, againstAway,
    rawForHome: rawProfile.forHome, rawForAway: rawProfile.forAway,
    playedHome: rawProfile.playedHome, playedAway: rawProfile.playedAway,
    form: rawProfile.form,
  };
}

/**
 * Iki takimin gol profilinden, mevcut poisson.js ciktisiyla AYNI
 * sekilli bir projeksiyon objesi uretir.
 *
 * h2hInfo (opsiyonel): {avgTotalGoals, sampleSize} - iki takimin
 * birbirine karsi GECMIS maclarindaki ortalama toplam gol. Modelin
 * kendi (takim istatistiklerinden gelen) toplam gol beklentisini,
 * H2H ornek buyuklugune gore SINIRLI bir agirlikla bu yone ceker -
 * H2H hep kucuk bir ornektir, asla modelin tamamini ele gecirmez.
 */
function projectFixtureFromApiStats(evTakim, depTakim, homeProfile, awayProfile, h2hInfo){
  const noHome = !homeProfile || (homeProfile.forHome===null && homeProfile.forAway===null);
  const noAway = !awayProfile || (awayProfile.forHome===null && awayProfile.forAway===null);

  if(noHome || noAway){
    return {
      evTakim, depTakim, lambdaHome:null, lambdaAway:null, lambdaTotal:null,
      pOver15:null, pOver25:null, pBtts:null,
      guven:'VERI YOK', guvenScore:0, noData:true,
      tahminiSkor:'—', evForm: homeProfile?.form||'', depForm: awayProfile?.form||'',
      evGolOrt: homeProfile?.rawForHome ?? null, depGolOrt: awayProfile?.rawForAway ?? null,
    };
  }

  // Iki ayri tahminin ortalamasi: takimin kendi hucum gucu + rakibin savunma zaafi
  // (Bu degerler artik shrinkage uygulanmis - az veri varsa lig ortalamasina cekilmis)
  const lambdaHomeParts = [homeProfile.forHome, awayProfile.againstAway].filter(v=>v!==null);
  const lambdaAwayParts = [awayProfile.forAway, homeProfile.againstHome].filter(v=>v!==null);

  let lambdaHome = lambdaHomeParts.length ? lambdaHomeParts.reduce((a,b)=>a+b,0)/lambdaHomeParts.length : 1.3;
  let lambdaAway = lambdaAwayParts.length ? lambdaAwayParts.reduce((a,b)=>a+b,0)/lambdaAwayParts.length : 1.1;

  // H2H ayarlamasi: iki takimin GECMISTE birbirine karsi oynadigi maclarin
  // toplam gol ortalamasina hafifce yaslan. Agirlik, H2H ornek buyuklugune
  // gore artar ama en fazla ~%35'e kadar cikar - kucuk bir ornek asla
  // takim istatistiklerinin onune gecmemeli.
  if(h2hInfo && h2hInfo.sampleSize>0){
    const modelTotal = lambdaHome + lambdaAway;
    const h2hAgirlik = Math.min(0.35, h2hInfo.sampleSize/15);
    const yeniToplam = modelTotal*(1-h2hAgirlik) + h2hInfo.avgTotalGoals*h2hAgirlik;
    if(modelTotal>0){
      lambdaHome = yeniToplam * (lambdaHome/modelTotal);
      lambdaAway = yeniToplam * (lambdaAway/modelTotal);
    }
  }

  const lambdaTotal = lambdaHome + lambdaAway;

  const pOver15 = 1 - poissonCdf(1, lambdaTotal);
  const pOver25 = 1 - poissonCdf(2, lambdaTotal);
  const pNoHome = Math.exp(-lambdaHome);
  const pNoAway = Math.exp(-lambdaAway);
  const pBtts = (1-pNoHome)*(1-pNoAway);

  const minSample = Math.min(homeProfile.playedHome||0, awayProfile.playedAway||0);
  let guven, guvenScore;
  if(minSample===0){ guven='VERI YOK (0 mac)'; guvenScore=0; }
  else if(minSample<5){ guven=`DUSUK GUVEN (${minSample} mac)`; guvenScore=45; }
  else if(minSample<10){ guven=`ORTA GUVEN (${minSample} mac)`; guvenScore=70; }
  else { guven=`YETERLI VERI (${minSample} mac)`; guvenScore=88; }

  if(h2hInfo && h2hInfo.sampleSize>=3){
    guven += ` + H2H (${h2hInfo.sampleSize} maç)`;
  }

  const score = mostLikelyScore(lambdaHome, lambdaAway);

  return {
    evTakim, depTakim,
    lambdaHome: round2(lambdaHome), lambdaAway: round2(lambdaAway), lambdaTotal: round2(lambdaTotal),
    pOver15, pOver25, pBtts,
    guven, guvenScore, noData: minSample===0,
    tahminiSkor: `${score.h}-${score.a}`,
    evForm: homeProfile.form, depForm: awayProfile.form,
    evGolOrt: homeProfile.rawForHome, depGolOrt: awayProfile.rawForAway,
  };
}

/**
 * /api/h2h cevabindan (iki takimin gecmis karsilasmalari) toplam gol
 * ortalamasini cikarir. Skoru olmayan/hatali kayitlar atlanir.
 */
function extractH2HInfo(h2hResponseArray){
  if(!h2hResponseArray || h2hResponseArray.length===0) return null;
  const gollüMaclar = h2hResponseArray.filter(m =>
    m.goals && m.goals.home!==null && m.goals.away!==null &&
    (m.fixture?.status?.short==='FT' || m.fixture?.status?.short==='AET' || m.fixture?.status?.short==='PEN')
  );
  if(gollüMaclar.length===0) return null;
  const toplamGol = gollüMaclar.reduce((s,m)=>s+m.goals.home+m.goals.away, 0);
  return { avgTotalGoals: toplamGol/gollüMaclar.length, sampleSize: gollüMaclar.length };
}

/**
 * /api/odds cevabindan MUMKUN OLAN TUM Grup A pazarlarinin oranlarini
 * cikarir. Bulunamayan her pazar icin key hic eklenmez (uydurma yok).
 * Donen anahtarlar, markets.js'teki computeAllMarkets() ile AYNI
 * marketKey semasini kullanir, boylece iki taraf kesisimi alinabilir.
 */
function extractAllMarketOdds(oddsResponseArray){
  const odds = {};
  if(!oddsResponseArray || oddsResponseArray.length===0) return odds;

  const bookmakers = oddsResponseArray[0]?.bookmakers || [];

  const findValue = (bet, matchFn) => {
    const v = (bet.values||[]).find(x => matchFn((x.value||'').toLowerCase().trim()));
    return v ? parseFloat(v.odd) : null;
  };

  for(const bm of bookmakers){
    for(const bet of (bm.bets||[])){
      const name = (bet.name||'').toLowerCase();

      // Mac Sonucu
      if(name === 'match winner'){
        setIfMissing(odds,'MS1', findValue(bet, v=>v==='home'));
        setIfMissing(odds,'MSX', findValue(bet, v=>v==='draw'));
        setIfMissing(odds,'MS2', findValue(bet, v=>v==='away'));
      }

      // Cifte Sans
      if(name === 'double chance'){
        setIfMissing(odds,'CS_1X', findValue(bet, v=>v==='home/draw'));
        setIfMissing(odds,'CS_X2', findValue(bet, v=>v==='draw/away'));
        setIfMissing(odds,'CS_12', findValue(bet, v=>v==='home/away'));
      }

      // Toplam Gol Alt/Ust (birden fazla hat ayni bet icinde gelir)
      if(name.includes('over/under') && !name.includes('corner') && !name.includes('card') && !name.includes('half') && !name.includes('1st')){
        [0.5,1.5,2.5,3.5,4.5].forEach(line=>{
          setIfMissing(odds, `OU_${line}_OVER`, findValue(bet, v=>v===`over ${line}`));
          setIfMissing(odds, `OU_${line}_UNDER`, findValue(bet, v=>v===`under ${line}`));
        });
      }

      // Tek/Cift
      if(name === 'odd/even'){
        setIfMissing(odds,'ODD', findValue(bet, v=>v==='odd'));
        setIfMissing(odds,'EVEN', findValue(bet, v=>v==='even'));
      }

      // Karsilikli Gol
      if(name.includes('both teams score') || name==='btts'){
        setIfMissing(odds,'KGVAR', findValue(bet, v=>v==='yes'));
        setIfMissing(odds,'KGYOK', findValue(bet, v=>v==='no'));
      }
    }
  }
  return odds;
}

function setIfMissing(obj, key, val){
  if(val!==null && val!==undefined && !isNaN(val) && obj[key]===undefined) obj[key] = val;
}

