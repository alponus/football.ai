/**
 * api/team-fixtures.js — Bir takimin en son N macini getirir (form icin)
 * Kullanim: /api/team-fixtures?team=123&last=8
 */
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: 'SUNUCU_AYARI_EKSIK', mesaj: 'API_FOOTBALL_KEY tanimli degil.' });
  }
  const { team, last } = req.query;
  if (!team) {
    return res.status(400).json({ hata: 'EKSIK_PARAMETRE', mesaj: 'team parametresi gerekli.' });
  }

  try {
    const apiRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${team}&last=${last || 8}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
    }
    const data = await apiRes.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'Son maclar alinamadi.', detay: data.errors });
    }
    return res.status(200).json({ maclar: data.response || [] });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'Son maclara ulasilamadi.' });
  }
}
