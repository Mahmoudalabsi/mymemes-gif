# MyMemes GIF — مكتبة الميمز المتحركة

موقع ثاني لإخواني [MyMemes](https://github.com/Mahmoudalabsi/mymemes) — مكتبة GIF ميمز من Giphy بنفس التصميم الزمردي ونفس البنية.

**الرابط الإنتاجي**: <https://mymemes-gif.pages.dev>

## المزايا

- 🎞️ مكتبة GIF من Giphy (trending + بحث) — مع قاعدة احتياطية مدمجة (154 GIF)
- 🎨 نفس التصميم الزمردي لموقع الأصوات (فاتح افتراضي + داكن بزر تبديل)
- 🌍 ثلاث لغات (عربية / English / Română) مع RTL تلقائي
- 📊 عداد مشاهدات حي لكل GIF (ترحيل عبر Cloudflare KV)
- 🔄 زر علوي بارز ينقل لموقع الأصوات [mymemes.pages.dev](https://mymemes.pages.dev)
- 🔍 بحث فوري + أقسام + ترتيب (trending / popular / name)
- 🖼️ Lightbox لعرض الحجم الكامل + نسخ الرابط + تحميل + مشاركة
- ⚡ نشر على Cloudflare Pages (مجاني بلا حظر) + مرآة على Netlify (اختياري)

## البنية

```
static-site-gif/
├── public/                  # الملفات الثابتة (النشر)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── favicon.svg
│   ├── data/fallback-gifs.json   # قاعدة GIF احتياطية (154 صورة)
│   ├── _headers / _redirects / 404.html
├── functions/               # دوال Cloudflare Pages
│   ├── api/giphy.js         # بروكسي Giphy API + fallback
│   ├── api/plays.js         # عداد المشاهدات (KV)
│   └── download.js          # بروكسي تحميل GIF من media.giphy.com
├── netlify/                 # مرآة Netlify (اختياري)
│   └── functions/{giphy,plays,download}.js
├── netlify.toml
└── wrangler.toml
```

## الإعداد المحلي

```bash
npx wrangler pages dev . --port 8788
```

## النشر

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  npx wrangler pages deploy --branch main --commit-dirty=true
```

## مفتاح Giphy API (اختياري)

بدون مفتاح، يعمل الموقع بقاعدة GIF الاحتياطية المدمجة (154 صورة).

لتفعيل API الكامل:
1. احصل على مفتاح من <https://developers.giphy.com>
2. اضبطه في Cloudflare Pages → mymemes-gif → Settings → Environment variables
   - الاسم: `GIPHY_API_KEY`
   - القيمة: مفتاحك
3. أعد النشر (أو انتظر التحديث التلقائي)

## المصادر

- GIFs من [Giphy.com](https://giphy.com) (روابط CDN مباشرة بدون مفتاح)
- التصميم الأصلي من [MyMemes](https://github.com/Mahmoudalabsi/mymemes)

## الترخيص

الكود: MIT. ملفات GIF تخضع لشروط Giphy.
