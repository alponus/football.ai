/* ============================================================
   scoring.js — Risk siniflandirma, guc puani, cakisma kontrolu
   ============================================================
   ONEMLI TASARIM KARARI: "Marketleri Guvenli/Dengeli/Riskli grupla"
   istegini, market TURUNE (ör. "MS1 hep riskli") gore SABIT bir
   tabloyla degil, o anki HESAPLANAN OLASILIGA gore yapiyoruz.
   Neden: %85 olasilikli bir MS1, %30 olasilikli bir MS1'den çok
   daha guvenlidir - market adi ayni olsa da risk farklidir. Bu
   yaklasim daha dogru ve "veri uydurma" riskini de ortadan kaldirir.
*/

function classifyRisk(prob){
  if(prob >= 0.70) return 'Güvenli';
  if(prob >= 0.45) return 'Dengeli';
  return 'Riskli';
}

/**
 * Market Guc Siralamasi (0-100): model olasiligi + edge + guven puani
 * birlikte degerlendirilir. Agirliklar: olasilik %40, edge %30, veri
 * guveni %30.
 */
function gucPuani(leg){
  const olasilikPuani = leg.modelProb * 40;
  const edgeClamped = Math.max(-0.3, Math.min(0.3, leg.edge));
  const edgePuani = ((edgeClamped + 0.3) / 0.6) * 30;
  const guvenPuani = (leg.guvenScore/100) * 30;
  return Math.round(olasilikPuani + edgePuani + guvenPuani);
}

/**
 * Kupona Uygunluk Puani (0-100): tek basina guc puanindan farkli
 * olarak, kuponda ZATEN secilmis diger bacaklarla uyumunu da dikkate
 * alir - ayni pazar turunun tekrari veya tek bir lige asiri
 * yogunlasma puani dusurur (cesitlilik tesvik edilir).
 */
function kuponUygunlukPuani(leg, digerSecilenLegler){
  let puan = gucPuani(leg);
  const ayniPazar = digerSecilenLegler.filter(l=>l.pazar===leg.pazar).length;
  if(ayniPazar>0) puan -= 10*ayniPazar;
  return Math.max(0, Math.min(100, puan));
}

/**
 * Cakisma Kontrolu: birbirini zayiflatan pazar ciftleri.
 * Sadece AYNI MACTAN gelen bacaklar icin anlamlidir (farkli maclarin
 * pazarlari arasinda mantiksal cakisma olmaz).
 */
const CAKISMA_CIFTLERI = [
  ['KGYOK', 'OU_3.5_OVER'], ['KGYOK', 'OU_2.5_OVER'],
  ['MS1', 'MS2'], ['MS1', 'MSX'], ['MSX', 'MS2'],
  ['CS_1X', 'CS_X2'], ['CS_1X', 'CS_12'], ['CS_X2', 'CS_12'],
  ['ODD', 'EVEN'],
  ['OU_1.5_UNDER', 'OU_2.5_OVER'], ['OU_1.5_UNDER', 'OU_3.5_OVER'],
];

function marketsConflict(keyA, keyB){
  return CAKISMA_CIFTLERI.some(([a,b]) =>
    (a===keyA && b===keyB) || (a===keyB && b===keyA)
  );
}

/**
 * Bir maçın en güçlü pazarlarini SIRALARKEN, zaten secilmis olanla
 * cakisan bir sonraki pazari atlar - boylece "KG Yok" ve "3.5 Ust"
 * ayni maç icin yan yana "en güçlü senaryo" olarak gösterilmez.
 */
function pickTopMarketsNoConflict(allMarkets, n=3, keys=ANA_PAZAR_KEYS){
  const sirali = keys.filter(k=>allMarkets[k]).map(k=>[k, allMarkets[k]]).sort((a,b)=>b[1].prob-a[1].prob);
  const secilen = [];
  for(const [key, market] of sirali){
    if(secilen.length>=n) break;
    const cakisiyorMu = secilen.some(([sk]) => marketsConflict(sk, key));
    if(!cakisiyorMu) secilen.push([key, market]);
  }
  return secilen;
}
