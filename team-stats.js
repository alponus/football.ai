/**
 * api/team-stats.js — /teams/statistics icin guvenli proxy
 * Kullanim: /api/team-stats?team=123&league=39&season=2026
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
    const apiRes = await fetch(
      `https://v3.football.api-sports.io/teams/statistics?team=${team}&league=${league}&season=${season}`,
      { headers: { 'x-apisports-key': apiKey } }
    );
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ hata: 'API_HATASI', mesaj: `API ${apiRes.status} dondu.` });
    }
    const data = await apiRes.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ hata: 'API_LIMIT_VEYA_HATA', mesaj: 'Bu takim icin istatistik alinamadi.', detay: data.errors });
    }
    return res.status(200).json({ stats: data.response || null });
  } catch (err) {
    return res.status(500).json({ hata: 'BAGLANTI_HATASI', mesaj: 'Takim istatistigine ulasilamadi.' });
  }
}
