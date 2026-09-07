# Football AI Pro — Tarayıcı Tabanlı Analiz Paneli

Sunucu, kurulum, Python veya API gerektirmeyen; tamamen tarayıcında
çalışan bir futbol analiz ve kupon öneri sistemi.

## Nasıl açılır

`index.html` dosyasına çift tıkla — tarayıcında açılır. Bu kadar.
İnternet sadece yazı tiplerini (Google Fonts) yüklemek için kullanılır;
internet olmasa da temel işlevler çalışır.

## Sayfalar

- **index.html (Dashboard):** Veri girişi ve günlük analiz burada yapılır.
- **coupons.html:** Son analizin kupon önerilerini büyük görünümde gösterir.
- **analysis.html:** Tüm maç ve bacakların detaylı tablosu.
- **history.html:** Geçmiş raporlar + gerçek sonuç girme + başarı/ROI istatistiği.
- **settings.html:** Eşik değerleri, WhatsApp numarası, tema, yedekleme.

## Veri girme formatı (ÖNEMLİ)

Nesine/Mackolik'ten kopyaladığın ham metni doğrudan yapıştırmak
güvenilir çalışmaz — her sitenin sayfa düzeni farklı ve değişebilir.
Bunun yerine, kopyaladığın bilgiyi şu **sabit formata** dökerek
yapıştırman gerekiyor (birkaç saniye sürer, karşılığında güvenilir
ayrıştırma sağlar):

**Maç Verisi:**
```
Ev Takım - Deplasman Takım | 1.5U:1.35 KG:1.85
```
- `1.5U:` → 1.5 Üst oranı, `KG:` → Karşılıklı Gol Var oranı
- Ondalık için nokta ya da virgül fark etmez (1.35 veya 1,35)
- Bir pazarın oranı yoksa o kısmı hiç yazma

**Takım Geçmişi:**
```
Takım Adı | Ev veya Deplasman | Rakip | AttığıGol-YediğiGol | Tarih(opsiyonel)
```
örnek: `Galatasaray | Ev | Kasimpasa | 3-1 | 2026-08-10`

Format dışına çıkan satırlar **sessizce atlanmaz** — "Okunamayan
Satırlar" kutusunda ayrı ayrı gösterilir, hangi satırın neden
okunamadığını görürsün.

**Format seninkiyle uyuşmuyorsa:** Claude'a gerçekten kopyaladığın
ham metni yapıştır, parser'ı o örneğe göre günceller.

## WhatsApp, TXT, PDF — gerçekte nasıl çalışıyor

Bunları abartısız anlatıyorum, çünkü üçü de farklı şekilde çalışıyor:

- **TXT indir:** Gerçek otomatik indirme. Dosya doğrudan
  İndirilenler klasörüne düşer, Not Defteri'nde/TextEdit'te açılır.
- **PDF oluştur:** Kütüphanesiz bir yöntem kullanıyor — tarayıcının
  kendi Yazdır penceresini açar. Açılan pencerede yazıcı olarak
  **"PDF olarak kaydet"**i seçip kaydetmen gerekiyor (2 tık, otomatik
  dosya değil ama hiçbir kurulum gerektirmiyor).
- **WhatsApp'a Gönder:** Ücretsiz resmi bir "sessizce gönder" API'si
  yok. Buton, mesajı hazır şekilde WhatsApp'ı açar (bilgisayarda
  WhatsApp Web, telefonda WhatsApp uygulaması) — **sen** Gönder'e
  basarsın. Ayarlar'a kendi numaranı girersen direkt kendi sohbetin
  açılır.

## Veri nerede saklanıyor?

Tarayıcının `localStorage`'ında — yani bu bilgisayardaki bu tarayıcıda
kalıcı olarak saklanır (sayfayı kapatsan da kaybolmaz). Başka bir
bilgisayara geçersen, Ayarlar sayfasındaki **"Tüm Veriyi JSON Olarak
İndir"** ile yedek al, diğer bilgisayarda **"İçe Aktar"** ile geri yükle.

`data/` klasöründeki `.json` dosyaları örnek/şablon amaçlıdır, uygulama
onları otomatik okumaz (tarayıcı güvenliği yerel dosya okumaya izin
vermiyor) — içeriklerini Ayarlar sayfasından içe aktararak kullanabilirsin.

## İstatistik sayfası nasıl dolar?

Sistem maç sonuçlarını internetten otomatik öğrenemez (yine aynı
kısıt: canlı veri kaynağına bu ortamdan erişim yok). Bunun yerine:
her gün analiz yaptıktan sonra, ertesi gün **History** sayfasından o
günün bacaklarını "Doğru çıktı / Yanlış çıktı" olarak işaretlersin.
Bu birikimden gerçek başarı oranı, ROI ve en iyi/kötü market
otomatik hesaplanır.

## Modelin sınırları (durustça)

- Basit bir Poisson (beklenen gol) modeli — sakatlık, motivasyon,
  taktik gibi faktörleri hesaba katmıyor.
- Az geçmiş verisi olan takımlar "VERİ YOK" / "DÜŞÜK GÜVEN" etiketiyle
  işaretlenir ve **hiçbir zaman** kupon kombinasyonuna dahil edilmez —
  bunu bilerek güvenlik önlemi olarak ekledim.
- Pozitif edge, kazanma garantisi değildir; sadece modelin bahis
  şirketinin fiyatladığından farklı bir olasılık gördüğü anlamına gelir.
- "AI Bugünün Yorumu" gerçek bir yapay zeka çıkarımı değil, hesaplanan
  sayılardan otomatik üretilen kural tabanlı bir özet metindir.

## Dosya yapısı

```
football-ai/
├── index.html        (Dashboard — veri girişi + analiz)
├── analysis.html      (Detaylı maç/bacak tablosu)
├── coupons.html        (Kupon önerileri)
├── history.html         (Geçmiş raporlar + istatistik)
├── settings.html          (Eşikler, tema, yedekleme)
├── css/style.css, dashboard.css
├── js/
│   ├── storage.js     (localStorage katmanı)
│   ├── poisson.js     (beklenen gol modeli)
│   ├── edge.js         (edge / EV / risk / yıldız)
│   ├── parser.js        (yapıştırılan metni okuma)
│   ├── coupons.js         (kupon kombinasyon motoru)
│   ├── statistics.js        (başarı / ROI hesaplama)
│   └── app.js                (ortak sayfa iskeleti)
└── data/*.json        (örnek/yedek formatları)
```

## Yasal not

Bu araç istatistiksel bir analiz aracıdır, yatırım veya bahis tavsiyesi
değildir. Türkiye'de bahis yalnızca lisanslı platformlar üzerinden
yasaldır. Kayıp riski her zaman vardır; hiçbir sistem kazancı garanti
edemez.
