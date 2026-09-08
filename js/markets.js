/* ============================================================
   markets.js — Genisletilmis pazar motoru (Grup A)
   ============================================================
   Girdi: sadece lambdaHome ve lambdaAway (zaten hesaplaniyor).
   Cikti: her pazar icin { label, grup, prob } seklinde bir liste.

   Yontem: iki bagimsiz Poisson degiskeninin (ev golu, deplasman golu)
   olası skor matrisini kurup, her pazarin o matris uzerinden dogru
   (joint) olasiligini hesapliyoruz. MS+Alt/Ust veya MS+KG gibi
   BIRLESIK pazarlarda bagimsiz carpma YAPILMIYOR - dogrudan matristen
   ortak olasilik okunuyor (bkz. spesifikasyon madde 14 - korelasyon
   uyarisi).
*/

function buildScoreMatrix(lambdaHome, lambdaAway, maxGoals=8){
  const matrix = [];
  for(let h=0; h<=maxGoals; h++){
    matrix.push([]);
    for(let a=0; a<=maxGoals; a++){
      matrix[h][a] = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
    }
  }
  return matrix; // NOT: maxGoals=8 makul lambda'larda kutleyi >%99.9 kapsar, kuyruk ihmal edilir
}

function sumMatrix(matrix, conditionFn){
  let s = 0;
  for(let h=0; h<matrix.length; h++){
    for(let a=0; a<matrix[h].length; a++){
      if(conditionFn(h,a)) s += matrix[h][a];
    }
  }
  return s;
}

/**
 * lambdaHome, lambdaAway -> { marketKey: {label, grup, prob} }
 */
function computeAllMarkets(lambdaHome, lambdaAway){
  const matrix = buildScoreMatrix(lambdaHome, lambdaAway);
  const lambdaTotal = lambdaHome + lambdaAway;
  const m = {};

  const add = (key, label, grup, prob) => { m[key] = {label, grup, prob}; };

  // --- Mac Sonucu ---
  const ms1 = sumMatrix(matrix, (h,a)=>h>a);
  const msX = sumMatrix(matrix, (h,a)=>h===a);
  const ms2 = sumMatrix(matrix, (h,a)=>h<a);
  add('MS1','MS 1','Maç Sonucu', ms1);
  add('MSX','MS X','Maç Sonucu', msX);
  add('MS2','MS 2','Maç Sonucu', ms2);

  // --- Cifte Sans ---
  add('CS_1X','ÇŞ 1-X','Çifte Şans', ms1+msX);
  add('CS_X2','ÇŞ X-2','Çifte Şans', msX+ms2);
  add('CS_12','ÇŞ 1-2','Çifte Şans', ms1+ms2);

  // --- Toplam Gol Alt/Ust (tam Poisson toplami uzerinden, matrise gerek yok) ---
  [0.5,1.5,2.5,3.5,4.5].forEach(line=>{
    const under = poissonCdf(Math.floor(line), lambdaTotal);
    add(`OU_${line}_UNDER`, `${line} Alt`, 'Maç Sonucu Alt/Üst', under);
    add(`OU_${line}_OVER`, `${line} Üst`, 'Maç Sonucu Alt/Üst', 1-under);
  });

  // --- Taraf Alt/Ust (Ev/Deplasman ayri) ---
  [0.5,1.5,2.5].forEach(line=>{
    const underH = poissonCdf(Math.floor(line), lambdaHome);
    const underA = poissonCdf(Math.floor(line), lambdaAway);
    add(`EV_OU_${line}_UNDER`, `Ev Sahibi ${line} Alt`, 'Taraf Alt/Üst', underH);
    add(`EV_OU_${line}_OVER`, `Ev Sahibi ${line} Üst`, 'Taraf Alt/Üst', 1-underH);
    add(`DEP_OU_${line}_UNDER`, `Deplasman ${line} Alt`, 'Taraf Alt/Üst', underA);
    add(`DEP_OU_${line}_OVER`, `Deplasman ${line} Üst`, 'Taraf Alt/Üst', 1-underA);
  });

  // --- Tek/Cift ---
  const evenSum = sumMatrix(matrix, (h,a)=>(h+a)%2===0);
  add('ODD','Tek','Tek/Çift', 1-evenSum);
  add('EVEN','Çift','Tek/Çift', evenSum);

  // --- MS + Alt/Ust kombinasyonlari (1.5 ve 2.5 hatti) ---
  [1.5,2.5].forEach(line=>{
    const under = sumMatrix(matrix,(h,a)=>h+a<line);
    const over = sumMatrix(matrix,(h,a)=>h+a>line);
    add(`MS1_UNDER_${line}`, `MS1 & ${line} Alt`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h>a && h+a<line));
    add(`MS1_OVER_${line}`, `MS1 & ${line} Üst`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h>a && h+a>line));
    add(`MSX_UNDER_${line}`, `MSX & ${line} Alt`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h===a && h+a<line));
    add(`MSX_OVER_${line}`, `MSX & ${line} Üst`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h===a && h+a>line));
    add(`MS2_UNDER_${line}`, `MS2 & ${line} Alt`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h<a && h+a<line));
    add(`MS2_OVER_${line}`, `MS2 & ${line} Üst`, `MS ve ${line} Alt/Üst`, sumMatrix(matrix,(h,a)=>h<a && h+a>line));
  });

  // --- MS + KG kombinasyonlari ---
  const kgVarCond = (h,a)=>h>=1 && a>=1;
  add('MS1_KGVAR','MS1 & Var','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h>a && kgVarCond(h,a)));
  add('MS1_KGYOK','MS1 & Yok','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h>a && !kgVarCond(h,a)));
  add('MSX_KGVAR','MSX & Var','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h===a && kgVarCond(h,a)));
  add('MSX_KGYOK','MSX & Yok','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h===a && !kgVarCond(h,a)));
  add('MS2_KGVAR','MS2 & Var','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h<a && kgVarCond(h,a)));
  add('MS2_KGYOK','MS2 & Yok','MS ve Karşılıklı Gol', sumMatrix(matrix,(h,a)=>h<a && !kgVarCond(h,a)));

  // --- KG Var/Yok (genel) ---
  const pNoHome = Math.exp(-lambdaHome), pNoAway = Math.exp(-lambdaAway);
  const kgVar = (1-pNoHome)*(1-pNoAway);
  add('KGVAR','KG Var','Karşılıklı Gol', kgVar);
  add('KGYOK','KG Yok','Karşılıklı Gol', 1-kgVar);

  // --- Gol Yemeden Kazanir ---
  add('EV_TEMIZ_KAZANIR','Ev Sahibi Gol Yemeden Kazanır','Özel', pNoAway*(1-pNoHome));
  add('DEP_TEMIZ_KAZANIR','Deplasman Gol Yemeden Kazanır','Özel', pNoHome*(1-pNoAway));

  // --- Toplam Gol Araligi ---
  const p0=poissonPmf(0,lambdaTotal), p1=poissonPmf(1,lambdaTotal), p2=poissonPmf(2,lambdaTotal),
        p3=poissonPmf(3,lambdaTotal), p4=poissonPmf(4,lambdaTotal), p5=poissonPmf(5,lambdaTotal);
  add('GOL_ARALIK_0_1','0-1 Gol','Toplam Gol', p0+p1);
  add('GOL_ARALIK_2_3','2-3 Gol','Toplam Gol', p2+p3);
  add('GOL_ARALIK_4_5','4-5 Gol','Toplam Gol', p4+p5);
  add('GOL_ARALIK_6_PLUS','6+ Gol','Toplam Gol', 1-poissonCdf(5,lambdaTotal));

  // --- Mac Skoru (en olasi 6 skor + diger) ---
  const scores = [];
  for(let h=0; h<matrix.length; h++){
    for(let a=0; a<matrix[h].length; a++){
      scores.push({h, a, p: matrix[h][a]});
    }
  }
  scores.sort((x,y)=>y.p-x.p);
  let topSum = 0;
  scores.slice(0,6).forEach((s,i)=>{
    add(`SKOR_${s.h}_${s.a}`, `${s.h}:${s.a}`, 'Maç Skoru', s.p);
    topSum += s.p;
  });
  add('SKOR_DIGER','Diğer','Maç Skoru', Math.max(0, 1-topSum));

  return m;
}

/**
 * "En guclu senaryo" / yorum basligi icin anlamli pazar alt kumesi.
 * 0.5 Alt/Ust gibi zaten trivial (neredeyse kesin) pazarlar disarida
 * birakilir ki "en guclu senaryo" bilgi degeri tasisin.
 */
const ANA_PAZAR_KEYS = [
  'MS1','MSX','MS2','CS_1X','CS_X2','CS_12',
  'OU_1.5_OVER','OU_1.5_UNDER','OU_2.5_OVER','OU_2.5_UNDER','OU_3.5_OVER','OU_3.5_UNDER',
  'KGVAR','KGYOK','ODD','EVEN',
  'GOL_ARALIK_0_1','GOL_ARALIK_2_3','GOL_ARALIK_4_5','GOL_ARALIK_6_PLUS',
];

function pickTopMarkets(allMarkets, n=2, keys=ANA_PAZAR_KEYS){
  return keys
    .filter(k=>allMarkets[k])
    .map(k=>[k, allMarkets[k]])
    .sort((a,b)=>b[1].prob-a[1].prob)
    .slice(0,n);
}
