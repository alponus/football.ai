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

function finalizeCoupon(legs, tip, risk){
  const totalOdds = legs.reduce((p,l)=>p*l.odds, 1);
  const avgEdge = legs.reduce((s,l)=>s+l.edge,0)/legs.length;
  const avgGuven = legs.reduce((s,l)=>s+l.guvenScore,0)/legs.length;
  const combinedProb = legs.reduce((p,l)=>p*l.modelProb, 1);
  const avgGuc = legs.reduce((s,l)=>s+gucPuani(l),0)/legs.length;
  const stars = Math.round(Math.min(5, Math.max(0, avgGuc/20)));
  return {
    legs, totalOdds: round2(totalOdds), avgEdge, avgGuven,
    basariTahmini: combinedProb, stars, risk, tip,
  };
}

function farkliMacSecimi(adaylar, maxAdet, siralamaFn){
  const secilen = [];
  const kullanilanMaclar = new Set();
  const sirali = [...adaylar].sort(siralamaFn);
  for(const leg of sirali){
    if(secilen.length>=maxAdet) break;
    if(kullanilanMaclar.has(leg.mac)) continue;
    secilen.push(leg);
    kullanilanMaclar.add(leg.mac);
  }
  return secilen;
}

/**
 * GUVENLI KUPON: risk='Güvenli' (olasilik >=%70) bacaklardan 3-5 tanesi,
 * guc puanina gore en iyiler. Yeterli 'Güvenli' bacak yoksa 'Dengeli'
 * ile tamamlanir (bu durum aciklamada belirtilir).
 */
function buildGuvenliKupon(legs){
  const guvenliler = legs.filter(l=>classifyRisk(l.modelProb)==='Güvenli');
  let secim = farkliMacSecimi(guvenliler, 5, (a,b)=>gucPuani(b)-gucPuani(a));
  let tamamlamaNotu = null;
  if(secim.length<3){
    const dengeliler = legs.filter(l=>classifyRisk(l.modelProb)==='Dengeli' && !secim.some(s=>s.mac===l.mac));
    const ek = farkliMacSecimi(dengeliler, 3-secim.length, (a,b)=>gucPuani(b)-gucPuani(a));
    if(ek.length>0) tamamlamaNotu = `Yeterli sayıda yüksek olasılıklı bacak bulunamadığı için ${ek.length} orta güvenli seçim eklendi.`;
    secim = secim.concat(ek);
  }
  if(secim.length<2) return null;
  const kupon = finalizeCoupon(secim, 'Güvenli', 'Düşük');
  kupon.not = tamamlamaNotu;
  return kupon;
}

/**
 * DENGELI KUPON: Guvenli+Dengeli havuzundan, hedef oran araligina
 * (settings.targetMin - targetMax) ulasan en iyi kombinasyon.
 * haricLegKeys: daha once BASKA bir kupon tipinde kullanilan tam
 * (mac|pazar) ciftleri - ayni mac farkli pazarla burada yine kullanilabilir.
 */
function buildDengeliKupon(legs, settings, haricLegKeys=new Set()){
  const havuz = legs.filter(l=>classifyRisk(l.modelProb)!=='Riskli' && !haricLegKeys.has(l.mac+'|'+l.pazar));
  return enIyiKombinasyonuBul(havuz, settings.targetMin, settings.targetMax, settings.maxLegs, 'Dengeli', 'Orta');
}

/**
 * YUKSEK ORAN KUPONU: tum bacaklar havuzda, daha yuksek bir oran
 * araligi hedeflenir (hedefin ustu, ornegin 8-20).
 */
function buildYuksekOranKuponu(legs, settings, haricLegKeys=new Set()){
  const havuz = legs.filter(l=>!haricLegKeys.has(l.mac+'|'+l.pazar));
  const altSinir = Math.max(settings.targetMax, 8);
  return enIyiKombinasyonuBul(havuz, altSinir, altSinir*3, Math.min(settings.maxLegs+2,6), 'Yüksek Oran', 'Yüksek');
}

/**
 * SURPRIZ KUPON: risk seviyesine bakmaksizin SADECE pozitif edge'e
 * gore siralanir - "modelin value gordugu" seçimler.
 */
function buildSurprizKupon(legs, haricLegKeys=new Set()){
  const adaylar = legs.filter(l=>!haricLegKeys.has(l.mac+'|'+l.pazar));
  const secim = farkliMacSecimi(adaylar, 3, (a,b)=>b.edge-a.edge);
  if(secim.length<2) return null;
  const kupon = finalizeCoupon(secim, 'Sürpriz', 'Yüksek');
  if(secim[0] && secim[0].edge<0){
    kupon.not = 'Bugünkü veri setinde pozitif edge taşıyan yeterli seçim yok - bu kupon en az negatif olanlardan kuruldu, spekülatif kabul edilmeli.';
  }
  return kupon;
}

function enIyiKombinasyonuBul(candidates, targetMin, targetMax, maxLegs, tip, risk){
  if(candidates.length===0) return null;
  const sirali = [...candidates].sort((a,b)=>gucPuani(b)-gucPuani(a)).slice(0,14); // performans icin sinirla
  let enIyi = null, enIyiPuan = -1;

  for(let r=2; r<=Math.min(maxLegs, sirali.length); r++){
    for(const combo of combinations(sirali, r)){
      const macs = combo.map(c=>c.mac);
      if(new Set(macs).size !== macs.length) continue;
      const totalOdds = combo.reduce((p,c)=>p*c.odds, 1);
      if(totalOdds<targetMin || totalOdds>targetMax) continue;
      const ortalamaPuan = combo.reduce((s,c)=>s+gucPuani(c),0)/combo.length;
      if(ortalamaPuan>enIyiPuan){
        enIyiPuan = ortalamaPuan;
        enIyi = combo;
      }
    }
  }
  return enIyi ? finalizeCoupon(enIyi, tip, risk) : null;
}

/**
 * ANA FONKSIYON: 4 farkli stratejiyle 4 farkli kupon uretir.
 * Her biri farkli bir secim mantigi kullandigi icin ayni kombinasyonu
 * uretme ihtimalleri dogal olarak dusuktur; yine de son bir kontrolle
 * birebir ayni mac setini tekrar eden kupon elenir.
 */
function buildFourCoupons(legs, settings){
  const gecerliLegler = legs.filter(l=>
    !l.noData && l.odds>=settings.minOdds && l.odds<=settings.maxOdds
  );

  const sonuclar = {};
  const kullanilanSetler = [];

  const ekle = (key, kuponFn) => {
    const k = kuponFn();
    if(!k) { sonuclar[key] = null; return; }
    const macSet = new Set(k.legs.map(l=>l.mac));
    const tekrar = kullanilanSetler.some(s => s.size===macSet.size && [...s].every(m=>macSet.has(m)));
    if(tekrar){ sonuclar[key] = null; return; }
    kullanilanSetler.push(macSet);
    sonuclar[key] = k;
  };

  ekle('guvenli', ()=>buildGuvenliKupon(gecerliLegler));
  const kullanilanLegKeys = new Set((sonuclar.guvenli?.legs||[]).map(l=>l.mac+'|'+l.pazar));
  ekle('dengeli', ()=>buildDengeliKupon(gecerliLegler, settings, kullanilanLegKeys));
  (sonuclar.dengeli?.legs||[]).forEach(l=>kullanilanLegKeys.add(l.mac+'|'+l.pazar));
  ekle('yuksekOran', ()=>buildYuksekOranKuponu(gecerliLegler, settings, kullanilanLegKeys));
  (sonuclar.yuksekOran?.legs||[]).forEach(l=>kullanilanLegKeys.add(l.mac+'|'+l.pazar));
  ekle('surpriz', ()=>buildSurprizKupon(gecerliLegler, kullanilanLegKeys));

  return sonuclar;
}

function round2(n){ return Math.round(n*100)/100; }

