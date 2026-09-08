/* ============================================================
   insights.js — Kural tabanli aciklama/yorum uretimi
   ============================================================
   ONEMLI: Bunlar gercek bir AI muhakemesi degil, hesaplanan
   sayilardan (lambda, form, edge, guven) otomatik dokulen sablon
   metinlerdir. Hicbir zaman "kesin", "banko", "garanti" gibi
   kesinlik ifadeleri kullanilmaz - sadece olasilik dili.
*/

function formYorumu(form){
  if(!form || form.length===0) return null;
  const w = (form.match(/W/g)||[]).length;
  const l = (form.match(/L/g)||[]).length;
  if(w>=4) return 'oldukça istikrarlı';
  if(w>=3) return 'istikrarlı';
  if(l>=4) return 'zorlu bir dönemden geçen';
  if(l>=3) return 'form düşüklüğü yaşayan';
  return 'karışık sonuçlar alan';
}

/**
 * Tek bir mac icin 2-4 cumlelik tarafsiz yorum uretir.
 */
function generateMatchComment(proj, allMarkets){
  const cumleler = [];

  const evYorum = formYorumu(proj.evForm);
  const depYorum = formYorumu(proj.depForm);
  if(evYorum && depYorum){
    cumleler.push(`${proj.evTakim} son maçlarında ${evYorum} bir görüntü çizerken, ${proj.depTakim} ${depYorum} durumda.`);
  } else if(evYorum){
    cumleler.push(`${proj.evTakim} son maçlarında ${evYorum} bir görüntü çiziyor.`);
  } else if(depYorum){
    cumleler.push(`${proj.depTakim} son maçlarında ${depYorum} durumda.`);
  }

  cumleler.push(`Model, ${proj.evTakim} için maç başına yaklaşık ${proj.lambdaHome} gol, ${proj.depTakim} için ${proj.lambdaAway} gol beklentisi hesaplıyor.`);

  if(allMarkets){
    const top = pickTopMarkets(allMarkets, 2);
    const en = top[0], ikinci = top[1];
    if(en){
      cumleler.push(`${en[1].label} ihtimali (%${(en[1].prob*100).toFixed(0)}) modelin bu maç için gördüğü en güçlü senaryo olarak öne çıkıyor.`);
    }
    if(ikinci && ikinci[1].prob >= 0.25){
      cumleler.push(`Yine de ${ikinci[1].label} ihtimali de (%${(ikinci[1].prob*100).toFixed(0)}) tamamen göz ardı edilmemeli.`);
    }
  }

  if(proj.guvenScore < 60){
    cumleler.push(`Bu değerlendirme sınırlı sayıda maç verisine dayanıyor (${proj.guven}), temkinli yorumlanmalı.`);
  }

  return cumleler.join(' ');
}

/**
 * Tek bir market/bacak icin kisa "neden oneriliyor" aciklamasi.
 */
function generateMarketExplanation(leg){
  const edgeStr = leg.edge>=0 ? `+%${(leg.edge*100).toFixed(1)}` : `%${(leg.edge*100).toFixed(1)}`;
  const yon = leg.edge>=0 ? 'üzerinde' : 'altında';
  return `Model bu pazar için %${(leg.modelProb*100).toFixed(0)} olasılık hesaplıyor; bahis oranının ima ettiği olasılığın (%${(leg.implied*100).toFixed(0)}) ${yon} (${edgeStr} fark). Güven düzeyi: ${leg.guven}.`;
}

/**
 * Bir kupon icin "neden bu kupon olusturuldu" aciklamasi.
 */
function generateCouponExplanation(coupon, tip){
  const marketler = [...new Set(coupon.legs.map(l=>l.pazar))].join(', ');
  const enGuclu = [...coupon.legs].sort((a,b)=>b.edge-a.edge)[0];
  const tipCumlesi = {
    'Güvenli': 'düşük bacak sayısı ve göreceli olarak daha yüksek güvenle',
    'Dengeli': 'orta seviye risk ve oran dengesiyle',
    'Yüksek Oran': 'daha fazla bacak birleştirilerek yüksek toplam oran hedefiyle',
    'Sürpriz': 'modelin pozitif fark gördüğü, daha az konuşulan seçimlerden',
  }[tip] || 'mevcut verilerle';

  return `Bu kupon ${tipCumlesi} oluşturuldu. ${marketler} pazarlarından ${coupon.legs.length} seçim birleştirildi; ` +
    `en güçlü bacak ${enGuclu.mac} maçındaki ${enGuclu.pazar} seçimi (%${(enGuclu.modelProb*100).toFixed(0)} model olasılığı, edge ${enGuclu.edge>=0?'+':''}%${(enGuclu.edge*100).toFixed(1)}).`;
}
