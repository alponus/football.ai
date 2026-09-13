/**
 * api/standings.js — Lig puan durumu (guvenli proxy)
 * Kullanim: /api/standings?league=140&season=2026
 * Takim basina degil, LIG basina 1 istek - ucuz bir cagri.
 */
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: 'SUNUCU_AYARI_EKSIK', mesaj: 'API_FOOTBALL_KEY tanimli degil.' });
  }
  const { league, season } = req.query;
  if (!league || !season) {
    return res.status(400).json({ hata: 'EKSIK_PARAMETRE', mesaj: 'league ve season gerekli.' });
  }

  try {
    const apiRes = await fetch(
      `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
    }
    const data = await apiRes.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'Puan durumu alinamadi.', detay: data.errors });
    }
    // response[0].league.standings genelde tek grup icin [[...]] seklindedir (birden fazla grup da olabilir, kupa gibi)
    const gruplar = data.response?.[0]?.league?.standings || [];
    const tumTakimlar = gruplar.flat();
    return res.status(200).json({ standings: tumTakimlar });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'Puan durumuna ulasilamadi.' });
  }
}
