/* ============================================================
   edge.js — Edge / EV / Risk / Yildiz puanlama
   ============================================================ */

function impliedProbability(decimalOdds){
  return decimalOdds>0 ? 1/decimalOdds : 0;
}

/**
 * Bir "bacak" (mac + pazar + oran) icin tum degerlendirme metriklerini
 * hesaplar: model olasiligi, ima edilen olasilik, edge, EV, risk, yildiz.
 */
function evaluateLeg(mac, pazar, modelProb, odds, projection){
  const implied = impliedProbability(odds);
  const edge = modelProb - implied;
  const ev = modelProb * (odds - 1) - (1 - modelProb); // beklenen deger (birim stake basina)

  // Yildiz: guven skoru + edge birlikte belirler (0-5 yildiz)
  let stars = 0;
  if(!projection.noData){
    const edgeScore = Math.max(0, Math.min(1, edge / 0.20)); // %20 edge = tam puan
    const confScore = projection.guvenScore / 100;
    stars = Math.round((edgeScore*0.6 + confScore*0.4) * 5);
  }

  let risk;
  if(projection.noData) risk = 'Belirsiz';
  else if(edge >= 0.10 && projection.guvenScore >= 70) risk = 'Düşük';
  else if(edge >= 0.03) risk = 'Orta';
  else risk = 'Yüksek';

  return {
    mac, pazar, modelProb, odds, implied, edge, ev, stars, risk,
    guven: projection.guven, noData: projection.noData,
    guvenScore: projection.guvenScore,
  };
}

function starString(n){
  n = Math.max(0, Math.min(5, n));
  return '★'.repeat(n) + '☆'.repeat(5-n);
}

/**
 * Gunun genel ozetini metne doker (kural-tabanli, gercek bir dil modeli
 * degil - sadece hesaplanan istatistiklerin okunabilir bir ozeti).
 */
function generateDailyComment(legs, coupons, stats){
  const paras = [];
  const total = stats.analyzed;
  const playable = stats.playable;
  const valueCount = stats.value;

  paras.push(`Bugün analiz edilen ${total} pazarın ${playable} tanesi oynanabilir eşiklerin (oran aralığı, minimum güven) içinde, bunlardan ${valueCount} tanesinde modelin gördüğü olasılık bahis oranının üzerinde (pozitif edge).`);

  if(legs.length>0){
    const byMarket = {};
    legs.forEach(l=>{ (byMarket[l.pazar]=byMarket[l.pazar]||[]).push(l.edge); });
    let bestMarket=null, bestAvg=-Infinity;
    Object.keys(byMarket).forEach(m=>{
      const avg = byMarket[m].reduce((a,b)=>a+b,0)/byMarket[m].length;
      if(avg>bestAvg){ bestAvg=avg; bestMarket=m; }
    });
    if(bestMarket){
      paras.push(`Bugünkü veri setinde ortalama edge'i en yüksek pazar: ${bestMarket}.`);
    }
  }

  if(coupons.length>0){
    paras.push(`${coupons.length} kupon önerisi, ağırlıklı olarak pozitif edge gösteren pazarlardan kuruldu. Toplam oranı yüksek olan kuponlarda bacak sayısı arttıkça güven düşer — bunu yıldız puanına yansıttık.`);
  } else {
    paras.push(`Bugün hedeflenen oran aralığına (4.5–6.5) ulaşan, aynı zamanda pozitif edge taşıyan bir kombinasyon bulunamadı. Bu durumda sistem kupon önermek yerine "bugün oynama" uyarısı veriyor.`);
  }

  paras.push(`Not: Bu yorum, hesaplanan sayılardan otomatik oluşturulmuş bir özettir; gerçek bir uzman değerlendirmesi yerine geçmez.`);

  return paras;
}
