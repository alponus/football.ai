/**
 * api/fixtures.js — Guvenli API-Football proxy (Vercel Serverless Function)
 * ---------------------------------------------------------------------
 * Bu dosya TARAYICIDA calismaz, Vercel'in sunucusunda calisir. API key
 * burada process.env.API_FOOTBALL_KEY'den okunur - kullaniciya, tarayiciya
 * veya kaynak koda ASLA gonderilmez.
 *
 * Kullanim (tarayicidan):
 *   GET /api/fixtures                     -> bugunun fikstürü (Europe/Istanbul)
 *   GET /api/fixtures?date=2026-09-07     -> belirli bir tarih
 *   GET /api/fixtures?ids=123-456-789     -> belirli mac ID'lerini yeniden sorgular
 *                                             (en fazla 20 ID, sonuc kontrolu icin kullanilir)
 */

function istanbulDateString(){
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date()); // "YYYY-MM-DD" formatinda doner
}

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return res.status(500).json({
      hata: 'SUNUCU_AYARI_EKSIK',
      mesaj: 'API_FOOTBALL_KEY ortam degiskeni Vercel tarafinda ayarlanmamis. Ayarlar > Environment Variables kismini kontrol et.',
    });
  }

  const ids = req.query && req.query.ids;
  const date = (req.query && req.query.date) ? req.query.date : istanbulDateString();

  const url = ids
    ? `https://v3.football.api-sports.io/fixtures?ids=${encodeURIComponent(ids)}`
    : `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&timezone=Europe/Istanbul`;

  try {
    const apiRes = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

    const rateLimit = apiRes.headers.get('x-ratelimit-requests-remaining');
    const rateLimitTotal = apiRes.headers.get('x-ratelimit-requests-limit');

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        hata: 'API_HATASI',
        mesaj: `API-Football sunucusu ${apiRes.status} kodu dondu.`,
      });
    }

    const data = await apiRes.json();

    if (data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
      return res.status(200).json({
        hata: 'API_LIMIT_VEYA_HATA',
        mesaj: 'API gunluk kullanim limitine yaklasilmis veya baska bir hata olustu.',
        detay: data.errors,
      });
    }

    return res.status(200).json({
      tarih: ids ? null : date,
      toplamMac: data.results,
      kalanIstek: rateLimit,
      toplamIstekHakki: rateLimitTotal,
      maclar: data.response,
    });

  } catch (err) {
    return res.status(500).json({
      hata: 'BAGLANTI_HATASI',
      mesaj: 'API verisine su anda ulasilamiyor. Internet baglantisini veya API-Football servis durumunu kontrol et.',
    });
  }
}

