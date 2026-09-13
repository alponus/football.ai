/**
 * api/players.js — Bir takimin oyuncu istatistikleri (gol/asist)
 * Kullanim: /api/players?team=123&league=39&season=2026
 * Sayfalama otomatik yapilir (API sayfa basina ~20 oyuncu doner).
 */
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: 'SUNUCU_AYARI_EKSIK', mesaj: 'API_FOOTBALL_KEY tanimli degil.' });
  }
  const { team, league, season } = req.query;
  if (!team || !league || !season) {
    return res.status(400).json({ hata: 'EKSIK_PARAMETRE', mesaj: 'team, league ve season gerekli.' });
  }

  try {
    let tumOyuncular = [];
    let sayfa = 1, toplamSayfa = 1;

    do {
      const apiRes = await fetch(
        `https://v3.football.api-sports.io/players?team=${team}&league=${league}&season=${season}&page=${sayfa}`,
        { headers: { 'x-apisports-key': apiKey } }
      );
      if (!apiRes.ok) {
        return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
      }
      const data = await apiRes.json();
      if (data.errors && Object.keys(data.errors).length > 0) {
        return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'Oyuncu verisi alınamadı.', detay: data.errors });
      }
      tumOyuncular = tumOyuncular.concat(data.response || []);
      toplamSayfa = data.paging?.total || 1;
      sayfa++;
    } while (sayfa <= toplamSayfa && sayfa <= 3); // guvenlik icin en fazla 3 sayfa (~60 oyuncu)

    return res.status(200).json({ oyuncular: tumOyuncular });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'Oyuncu verisine ulaşılamadı.' });
  }
}
