/**
 * api/injuries.js — Belirli bir mac icin sakat/cezali oyuncu listesi
 * Kullanim: /api/injuries?fixture=123456
 */
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: 'SUNUCU_AYARI_EKSIK', mesaj: 'API_FOOTBALL_KEY tanimli degil.' });
  }
  const { fixture } = req.query;
  if (!fixture) {
    return res.status(400).json({ hata: 'EKSIK_PARAMETRE', mesaj: 'fixture parametresi gerekli.' });
  }

  try {
    const apiRes = await fetch(
      `https://v3.football.api-sports.io/injuries?fixture=${fixture}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
    }
    const data = await apiRes.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'Sakatlık verisi alınamadı.', detay: data.errors });
    }
    return res.status(200).json({ sakatlar: data.response || [] });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'Sakatlık verisine ulaşılamadı.' });
  }
}
