/* ============================================================
   resultChecker.js — Otomatik sonuc dogrulama (madde 12)
   ============================================================
   Kaydedilmis raporlardaki her bacagin ait oldugu fixture ID'sini
   toplar, API-Football'dan (20'serli gruplar halinde, batch limiti)
   guncel durumu sorar. Mac bitmisse (FT/AET/PEN) gercek skoru
   checkOutcome() ile karsilastirip otomatik olarak dogru/yanlis
   loglar - elle giris GEREKMEZ.

   Ayni bacak iki kez loglanmasin diye kontrol edilenler
   fai_checked_legs altinda ayri saklanir.
*/

function getCheckedLegs(){ return fai_get('fai_checked_legs', []); }
function markLegChecked(key){
  const list = getCheckedLegs();
  list.push(key);
  fai_set('fai_checked_legs', list);
}

async function checkAllPendingResults(onProgress){
  const reports = getReports();
  const checkedSet = new Set(getCheckedLegs());

  // 1) Kontrol edilmemis, fixtureId'si olan tum bacaklari topla
  const bekleyenFixtureIds = new Set();
  const legIndex = []; // {dateKey, leg, checkKey}

  Object.keys(reports).forEach(dateKey=>{
    const report = reports[dateKey];
    (report.legs||[]).forEach(leg=>{
      if(!leg.fixtureId || !leg.marketKey) return; // manuel akistan gelen bacaklarda bu bilgi yok
      const checkKey = `${dateKey}|${leg.fixtureId}|${leg.marketKey}`;
      if(checkedSet.has(checkKey)) return;
      bekleyenFixtureIds.add(leg.fixtureId);
      legIndex.push({dateKey, leg, checkKey});
    });
  });

  if(bekleyenFixtureIds.size===0){
    return {kontrolEdilenMac:0, yeniSonuc:0, mesaj:'Kontrol edilecek yeni bacak yok.'};
  }

  // 2) Fixture ID'lerini 20'serli gruplar halinde sorgula (API batch limiti)
  const idListesi = Array.from(bekleyenFixtureIds);
  const finalSkorlar = new Map(); // fixtureId -> {home, away, bitti}
  const gruplar = [];
  for(let i=0;i<idListesi.length;i+=20) gruplar.push(idListesi.slice(i,i+20));

  const FINISHED = new Set(['FT','AET','PEN']);
  let sorgulanan = 0;

  for(const grup of gruplar){
    try{
      const res = await fetch(`/api/fixtures?ids=${grup.join('-')}`);
      const data = await res.json();
      if(data.hata){ continue; } // bu grup basarisiz oldu, digerlerine devam
      (data.maclar||[]).forEach(m=>{
        const bitti = FINISHED.has(m.fixture.status.short);
        finalSkorlar.set(m.fixture.id, {
          home: m.goals.home, away: m.goals.away, bitti,
        });
      });
    }catch(e){ /* bu grubu atla, digerleri denenir */ }
    sorgulanan += grup.length;
    if(onProgress) onProgress(sorgulanan, idListesi.length);
  }

  // 3) Biten macların sonucunu hesapla ve logla (sadece BU sorguda istenen ID'ler uzerinden)
  let yeniSonuc = 0;
  const bitenFixtureIds = new Set();
  idListesi.forEach(id=>{
    const v = finalSkorlar.get(id);
    if(v && v.bitti) bitenFixtureIds.add(id);
  });
  const kontrolEdilenMac = bitenFixtureIds.size;

  legIndex.forEach(({dateKey, leg, checkKey})=>{
    const skor = finalSkorlar.get(leg.fixtureId);
    if(!skor || !skor.bitti) return; // hala oynanmadi/bitmedi - bir sonraki kontrolde tekrar denenir

    const dogruMu = checkOutcome(leg.marketKey, skor.home, skor.away);
    if(dogruMu===null){ markLegChecked(checkKey); return; } // bu pazar otomatik dogrulanamiyor (ör. Skor/Diger)

    addLoggedResult({
      tarih: dateKey, mac: leg.mac, pazar: leg.pazar, oran: leg.odds,
      sonuc: dogruMu ? 'dogru' : 'yanlis', stake: 1,
      lig: leg.lig || 'Bilinmiyor', guvenScore: leg.guvenScore,
      otomatik: true,
    });
    markLegChecked(checkKey);
    yeniSonuc++;
  });

  return {
    kontrolEdilenMac, yeniSonuc,
    bekleyenMacSayisi: idListesi.length - kontrolEdilenMac,
    mesaj: `${kontrolEdilenMac} maç bitmiş bulundu, ${yeniSonuc} yeni sonuç kaydedildi.`,
  };
}
