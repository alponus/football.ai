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
 * sayilari cikarir. Eksik alanlar icin null doner, ASLA veri uydurmaz.
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

/**
 * Iki takimin gol profilinden, mevcut poisson.js ciktisiyla AYNI
 * sekilli bir projeksiyon objesi uretir.
 */
function projectFixtureFromApiStats(evTakim, depTakim, homeProfile, awayProfile){
  const noHome = !homeProfile || (homeProfile.forHome===null && homeProfile.forAway===null);
  const noAway = !awayProfile || (awayProfile.forHome===null && awayProfile.forAway===null);

  if(noHome || noAway){
    return {
      evTakim, depTakim, lambdaHome:null, lambdaAway:null, lambdaTotal:null,
      pOver15:null, pOver25:null, pBtts:null,
      guven:'VERI YOK', guvenScore:0, noData:true,
      tahminiSkor:'—', evForm: homeProfile?.form||'', depForm: awayProfile?.form||'',
      evGolOrt: homeProfile?.forHome ?? null, depGolOrt: awayProfile?.forAway ?? null,
    };
  }

  // Iki ayri tahminin ortalamasi: takimin kendi hucum gucu + rakibin savunma zaafi
  const lambdaHomeParts = [homeProfile.forHome, awayProfile.againstAway].filter(v=>v!==null);
  const lambdaAwayParts = [awayProfile.forAway, homeProfile.againstHome].filter(v=>v!==null);

  const lambdaHome = lambdaHomeParts.length ? lambdaHomeParts.reduce((a,b)=>a+b,0)/lambdaHomeParts.length : 1.3;
  const lambdaAway = lambdaAwayParts.length ? lambdaAwayParts.reduce((a,b)=>a+b,0)/lambdaAwayParts.length : 1.1;
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

  const score = mostLikelyScore(lambdaHome, lambdaAway);

  return {
    evTakim, depTakim,
    lambdaHome: round2(lambdaHome), lambdaAway: round2(lambdaAway), lambdaTotal: round2(lambdaTotal),
    pOver15, pOver25, pBtts,
    guven, guvenScore, noData: minSample===0,
    tahminiSkor: `${score.h}-${score.a}`,
    evForm: homeProfile.form, depForm: awayProfile.form,
    evGolOrt: homeProfile.forHome, depGolOrt: awayProfile.forAway,
  };
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

