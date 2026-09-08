/* ============================================================
   outcomes.js — Gercek skordan pazar sonucunu dogrular
   ============================================================
   markets.js'teki HER market anahtari icin, nihai skor (ev, dep)
   verildiginde o pazarin tutup tutmadigini hesaplar. Boylece gecmis
   tahminler, mac bitince API'den gelen GERCEK skorla otomatik
   karsilastirilabilir - elle "dogru/yanlis" isaretlemeye gerek kalmaz.

   Donus degeri: true (tuttu) / false (tutmadi) / null (bu anahtar
   icin otomatik dogrulama desteklenmiyor - ör. SKOR_DIGER, hangi
   skorlarin "diger" kumesine girdigi ana kadar sakli olmadigi icin).
*/

function checkOutcome(marketKey, homeGoals, awayGoals){
  const total = homeGoals + awayGoals;

  if(marketKey==='MS1') return homeGoals > awayGoals;
  if(marketKey==='MSX') return homeGoals === awayGoals;
  if(marketKey==='MS2') return homeGoals < awayGoals;

  if(marketKey==='CS_1X') return homeGoals >= awayGoals;
  if(marketKey==='CS_X2') return homeGoals <= awayGoals;
  if(marketKey==='CS_12') return homeGoals !== awayGoals;

  if(marketKey==='ODD') return total % 2 === 1;
  if(marketKey==='EVEN') return total % 2 === 0;

  if(marketKey==='KGVAR') return homeGoals>=1 && awayGoals>=1;
  if(marketKey==='KGYOK') return !(homeGoals>=1 && awayGoals>=1);

  if(marketKey==='EV_TEMIZ_KAZANIR') return awayGoals===0 && homeGoals>0;
  if(marketKey==='DEP_TEMIZ_KAZANIR') return homeGoals===0 && awayGoals>0;

  // Toplam Gol Alt/Ust: OU_{line}_OVER / OU_{line}_UNDER
  let m = marketKey.match(/^OU_([\d.]+)_(OVER|UNDER)$/);
  if(m){
    const line = parseFloat(m[1]);
    return m[2]==='OVER' ? total > line : total < line;
  }

  // Taraf Alt/Ust: EV_OU_{line}_OVER/UNDER, DEP_OU_{line}_OVER/UNDER
  m = marketKey.match(/^EV_OU_([\d.]+)_(OVER|UNDER)$/);
  if(m){
    const line = parseFloat(m[1]);
    return m[2]==='OVER' ? homeGoals > line : homeGoals < line;
  }
  m = marketKey.match(/^DEP_OU_([\d.]+)_(OVER|UNDER)$/);
  if(m){
    const line = parseFloat(m[1]);
    return m[2]==='OVER' ? awayGoals > line : awayGoals < line;
  }

  // MS + Alt/Ust kombinasyonu: MS1_UNDER_1.5, MS2_OVER_2.5 vb.
  m = marketKey.match(/^(MS1|MSX|MS2)_(UNDER|OVER)_([\d.]+)$/);
  if(m){
    const msOk = checkOutcome(m[1], homeGoals, awayGoals);
    const line = parseFloat(m[3]);
    const ouOk = m[2]==='OVER' ? total > line : total < line;
    return msOk && ouOk;
  }

  // MS + KG kombinasyonu: MS1_KGVAR, MSX_KGYOK vb.
  m = marketKey.match(/^(MS1|MSX|MS2)_(KGVAR|KGYOK)$/);
  if(m){
    const msOk = checkOutcome(m[1], homeGoals, awayGoals);
    const kgOk = checkOutcome(m[2], homeGoals, awayGoals);
    return msOk && kgOk;
  }

  // Toplam Gol Araligi
  if(marketKey==='GOL_ARALIK_0_1') return total<=1;
  if(marketKey==='GOL_ARALIK_2_3') return total>=2 && total<=3;
  if(marketKey==='GOL_ARALIK_4_5') return total>=4 && total<=5;
  if(marketKey==='GOL_ARALIK_6_PLUS') return total>=6;

  // Kesin skor: SKOR_2_1 gibi
  m = marketKey.match(/^SKOR_(\d+)_(\d+)$/);
  if(m) return homeGoals===parseInt(m[1]) && awayGoals===parseInt(m[2]);

  // SKOR_DIGER ve taninmayan anahtarlar: otomatik dogrulanamaz
  return null;
}
