/**
 * api/h2h.js — /fixtures/headtohead icin guvenli proxy
 * Kullanim: /api/h2h?teams=33-34&last=10
 */
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: 'SUNUCU_AYARI_EKSIK', mesaj: 'API_FOOTBALL_KEY tanimli degil.' });
  }
  const { teams, last } = req.query;
  if (!teams) {
    return res.status(400).json({ hata: 'EKSIK_PARAMETRE', mesaj: 'teams parametresi gerekli (ör: 33-34).' });
  }

  try {
    const apiRes = await fetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${teams}&last=${last || 10}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
    }
    const data = await apiRes.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'H2H verisi alinamadi.', detay: data.errors });
    }
    return res.status(200).json({ h2h: data.response || [] });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'H2H verisine ulasilamadi.' });
  }
}
