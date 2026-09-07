/* ============================================================
   parser.js — Yapistirilan metni okur
   ============================================================
   BEKLENEN FORMAT (Mac Verisi kutusu) — her satirda bir mac:
     Ev Takim - Deplasman Takim | 1.5U:1.35 KG:1.85
   - "|" den once takimlar, sonra pazar:oran ciftleri (bosluk ile ayrik)
   - 1.5U / 1,5U / 1.5UST hepsi "1.5 Ust" pazarina; KG / KGVAR "KG Var" pazarina eslenir
   - Ondalik ayirici olarak hem nokta hem virgul kabul edilir

   BEKLENEN FORMAT (Takim Gecmisi kutusu) — her satirda bir mac:
     Takim Adi | Saha | Rakip | AttigiGol-YedigiGol | Tarih(opsiyonel)
   ornek:
     Galatasaray | Ev | Kasimpasa | 3-1 | 2026-08-10

   Bu formatlar disina cikan satirlar sessizce atlanmaz — parse
   edilemeyen her satir "hatali satirlar" listesine eklenir ve
   kullaniciya gosterilir, boylece veri kaybi fark edilir.
*/

function toNumber(str){
  if(!str) return NaN;
  return parseFloat(str.replace(',', '.'));
}

function parseFixturesText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  const fixtures = [];
  const errors = [];

  lines.forEach((line, idx)=>{
    const parts = line.split('|');
    if(parts.length < 2){
      errors.push({line: idx+1, text: line, reason: "\"|\" ayirici bulunamadi"});
      return;
    }
    const teamsPart = parts[0].trim();
    const oddsPart = parts.slice(1).join('|').trim();

    const teamSplit = teamsPart.split(/\s+-\s+| - |-/).map(s=>s.trim()).filter(Boolean);
    if(teamSplit.length < 2){
      errors.push({line: idx+1, text: line, reason: "Ev/Deplasman takimi ayristirilamadi (\" - \" ile ayirin)"});
      return;
    }
    const ev = teamSplit[0];
    const dep = teamSplit.slice(1).join(' - ');

    let oran15 = null, oranKg = null;
    const m15 = oddsPart.match(/1[.,]?5\s*U(?:ST)?\s*:?\s*([\d.,]+)/i);
    if(m15) oran15 = toNumber(m15[1]);
    const mKg = oddsPart.match(/KG\s*(?:VAR)?\s*:?\s*([\d.,]+)/i);
    if(mKg) oranKg = toNumber(mKg[1]);

    if(oran15===null && oranKg===null){
      errors.push({line: idx+1, text: line, reason: "1.5U: veya KG: formatinda oran bulunamadi"});
      return;
    }

    fixtures.push({ ev, deplasman: dep, oran15: oran15!==null?oran15:'', oranKg: oranKg!==null?oranKg:'' });
  });

  return { fixtures, errors };
}

function parseHistoryText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  const history = [];
  const errors = [];

  lines.forEach((line, idx)=>{
    const parts = line.split('|').map(s=>s.trim());
    if(parts.length < 4){
      errors.push({line: idx+1, text: line, reason: "Beklenen format: Takim | Saha | Rakip | Gol-Gol | Tarih(opsiyonel)"});
      return;
    }
    const [takim, saha, rakip, skor, tarih] = parts;
    if(!/^(Ev|Deplasman)$/i.test(saha)){
      errors.push({line: idx+1, text: line, reason: "Saha alani tam olarak \"Ev\" veya \"Deplasman\" olmali"});
      return;
    }
    const scoreMatch = skor.match(/(\d+)\s*-\s*(\d+)/);
    if(!scoreMatch){
      errors.push({line: idx+1, text: line, reason: "Skor \"3-1\" formatinda olmali"});
      return;
    }
    history.push({
      takim, saha: saha.charAt(0).toUpperCase()+saha.slice(1).toLowerCase(),
      rakip, attigi: parseInt(scoreMatch[1]), yedigi: parseInt(scoreMatch[2]),
      tarih: tarih || '',
    });
  });

  return { history, errors };
}
