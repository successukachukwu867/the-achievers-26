require('dotenv').config();
const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Uploads folder ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename:    (_, file, cb) => cb(null, `photo_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────
function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Card HTML builder ─────────────────────────────────────────────────────────
function buildCardHTML(data, photoBase64, mime) {
  const photoSrc = photoBase64 ? `data:${mime};base64,${photoBase64}` : null;
  const photoInner = photoSrc
    ? `<img src="${photoSrc}" alt="Photo" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;">`
    : `<div class="photo-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg></div>`;
  const dob = `${ordinal(parseInt(data.dobDay))} of ${MONTHS[parseInt(data.dobMonth) - 1]}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Achievers 26' – ${esc(data.fullName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Bebas+Neue&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#111;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;font-family:'Montserrat',sans-serif;padding:16px;}
  .card{width:100%;max-width:520px;background:linear-gradient(160deg,#1e6b1e 0%,#0e4a0e 35%,#0a3a0a 65%,#1a5c1a 100%);border-radius:18px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.7);}
  .bg-decor{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
  .bg-ruler{position:absolute;top:0;left:0;right:0;height:6px;background:repeating-linear-gradient(90deg,transparent 0px,transparent 8px,rgba(245,200,66,0.28) 8px,rgba(245,200,66,0.28) 10px);}
  .bg-ruler-bottom{position:absolute;bottom:0;left:0;right:0;height:6px;background:repeating-linear-gradient(90deg,transparent 0px,transparent 8px,rgba(245,200,66,0.22) 8px,rgba(245,200,66,0.22) 10px);}
  .bg-lines{position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(255,255,255,0.013) 40px,rgba(255,255,255,0.013) 41px);}
  .bg-sparkle{position:absolute;border-radius:50%;background:radial-gradient(circle,#f9d84a 0%,transparent 70%);}
  .gold-blob-tr{position:absolute;top:-15px;right:-15px;width:150px;height:150px;background:radial-gradient(ellipse at 40% 40%,#f9d84a 0%,#d4a017 45%,#8a6000 85%,transparent 100%);border-radius:50% 20% 60% 30%;opacity:0.95;z-index:1;}
  .gold-blob-bl{position:absolute;bottom:-20px;left:-20px;width:170px;height:170px;background:radial-gradient(ellipse at 40% 40%,#f9d84a 0%,#d4a017 45%,#8a6000 85%,transparent 100%);border-radius:40% 60% 30% 70%;opacity:0.9;z-index:1;}
  .bg-star{position:absolute;opacity:0.18;}
  .header{position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:14px 14px 8px;}
  .logo-circle{width:40px;height:40px;border-radius:50%;background:#fff;border:2px solid #f5c842;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.3);}
  .header-text{flex:1;min-width:0;}
  .assoc-name{font-size:11px;font-weight:800;color:#fff;letter-spacing:0.04em;text-transform:uppercase;line-height:1.25;}
  .university{font-size:10px;font-weight:700;color:#f5c842;letter-spacing:0.05em;text-transform:uppercase;}
  .divider-dots{border:none;border-top:2px dashed rgba(245,200,66,0.4);margin:0 14px 4px;position:relative;z-index:2;}
  .title-section{position:relative;z-index:2;text-align:center;padding:6px 14px 4px;}
  .script-title{font-family:'Dancing Script',cursive;font-size:42px;color:#fff;line-height:1.1;text-shadow:2px 2px 8px rgba(0,0,0,0.4);}
  .class-badge{display:inline-block;background:#2a8a2a;color:#000;font-size:14px;font-weight:900;letter-spacing:0.08em;padding:3px 20px;border-radius:4px;margin-top:3px;text-transform:uppercase;}
  .body{position:relative;z-index:2;display:flex;gap:10px;padding:10px 14px 0;align-items:flex-start;}
  .left-col{width:220px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;position:relative;border-radius:10px;overflow:hidden;}
  .left-col>*{position:relative;z-index:1;}
  .meet-badge{align-self:flex-start;margin-bottom:6px;line-height:1;}
  .meet-line{font-family:'Bebas Neue',sans-serif;font-size:34px;color:#fff;line-height:0.92;display:block;font-style:italic;text-shadow:3px 3px 0px rgba(0,0,0,0.4);letter-spacing:0.02em;}
  .the-finalist-row{display:flex;align-items:center;gap:3px;line-height:1;}
  .the-pill{display:inline-flex;align-items:center;justify-content:center;background:#f5c842;color:#111;font-size:10px;font-weight:900;padding:2px 5px;border-radius:3px;text-transform:lowercase;font-family:'Montserrat',sans-serif;}
  .finalist-line{font-family:'Bebas Neue',sans-serif;font-size:34px;color:#fff;line-height:0.92;display:block;font-style:italic;text-shadow:3px 3px 0px rgba(0,0,0,0.4);letter-spacing:0.02em;}
  .photo-frame-wrap{width:100%;position:relative;padding:4px;}
  .photo-frame{width:100%;height:270px;position:relative;background:#fff;padding:8px 8px 0px 8px;transform:rotate(-2.5deg);box-shadow:4px 4px 18px rgba(0,0,0,0.7),-2px -2px 8px rgba(0,0,0,0.35);clip-path:polygon(0% 1%,3% 0%,6% 1.5%,10% 0%,13% 1%,17% 0%,20% 1.5%,24% 0.5%,27% 0%,31% 1%,35% 0%,39% 1.5%,43% 0%,47% 1%,51% 0%,55% 1.5%,59% 0%,63% 1%,67% 0%,71% 1.5%,75% 0%,79% 1%,83% 0%,87% 1.5%,91% 0%,95% 1%,98% 0.5%,100% 0%,100% 0%,99% 3%,100% 7%,99.5% 12%,100% 17%,99% 22%,100% 27%,99.5% 32%,100% 37%,99% 42%,100% 47%,99.5% 52%,100% 57%,99% 62%,100% 67%,99.5% 72%,100% 77%,99% 82%,100% 87%,99.5% 92%,100% 97%,99% 100%,99% 100%,95% 99%,91% 100%,87% 98.5%,83% 100%,79% 99%,75% 100%,71% 98.5%,67% 100%,63% 99%,59% 100%,55% 98.5%,51% 100%,47% 99%,43% 100%,39% 98.5%,35% 100%,31% 99%,27% 100%,23% 98.5%,19% 100%,15% 99%,11% 100%,7% 98.5%,3% 100%,0% 100%,0% 100%,1% 97%,0% 92%,1% 87%,0% 82%,1% 77%,0% 72%,1% 67%,0% 62%,1% 57%,0% 52%,1% 47%,0% 42%,1% 37%,0% 32%,1% 27%,0% 22%,1% 17%,0% 12%,1% 7%,0% 2%);display:flex;flex-direction:column;}
  .photo-caption{background:#fff;width:100%;text-align:center;padding:5px 6px 6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:3px;overflow:hidden;}
  .photo-caption-label{font-size:9px;color:#555;font-weight:700;font-style:italic;display:inline-block;transform:skewX(-10deg);white-space:nowrap;}
  .photo-caption-value{font-size:10px;color:#111;font-weight:900;font-style:italic;display:inline-block;transform:skewX(-10deg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}
  .photo-inner{width:100%;flex:1;min-height:0;overflow:hidden;background:linear-gradient(160deg,#3a8a3a,#1a5a1a);border-radius:1px;}
  .photo-placeholder{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,#3a8a3a,#1a5a1a);color:rgba(255,255,255,0.5);gap:8px;}
  .name-badge-wrap{margin-top:8px;width:100%;padding:2.5px;background:linear-gradient(90deg,#f5c842,#d4a017,#f5c842);clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);box-shadow:0 2px 6px rgba(0,0,0,0.4);}
  .name-badge{background:linear-gradient(90deg,#3aaa3a,#1a7a1a);padding:4px 6px;text-align:center;width:100%;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%);}
  .full-name{font-size:clamp(7px,1.8vw,12px);font-weight:900;color:#fffde7;text-transform:uppercase;letter-spacing:0.02em;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,0.5);word-break:break-word;}
  .nickname-badge-wrap{margin-top:4px;width:100%;padding:2.5px;background:linear-gradient(90deg,#1a5c1a,#0e3d0e,#1a5c1a);clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);}
  .nickname-badge{background:linear-gradient(90deg,#f5c842,#e8b820);padding:4px 6px;width:100%;text-align:center;clip-path:polygon(4px 0%,100% 0%,calc(100% - 4px) 100%,0% 100%);}
  .nickname-badge span{font-size:clamp(7px,1.8vw,12px);font-weight:900;color:#1a1a00;letter-spacing:0.12em;text-transform:uppercase;word-break:break-word;}
  .right-col{flex:1;min-width:0;display:flex;flex-direction:column;padding-top:2px;}
  .right-col-inner{display:flex;flex-direction:column;gap:0;}
  .stat-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0;gap:4px;border-bottom:1.5px solid rgba(212,170,30,0.85);}
  .stat-label{font-size:clamp(6px,1.6vw,9px);color:#cce8cc;font-weight:600;white-space:normal;flex-shrink:0;max-width:55%;}
  .stat-value{font-size:clamp(6px,1.7vw,9px);color:#fff;font-weight:800;text-align:right;word-break:break-word;max-width:45%;}
  .quote-row{padding:4px 0;border-bottom:1.5px solid rgba(212,170,30,0.85);}
  .quote-label{font-size:9px;color:#cce8cc;font-weight:600;}
  .quote-text{font-size:9px;color:#fff;font-weight:700;line-height:1.4;margin-top:1px;}
  .exp-block{padding:4px 0;border-bottom:1.5px solid rgba(212,170,30,0.85);}
  .exp-label{font-size:9px;color:#cce8cc;font-weight:600;line-height:1.3;}
  .exp-value{font-size:9px;color:#fff;font-weight:800;margin-top:1px;}
  .footer-space{height:26px;position:relative;z-index:2;}
</style>
</head>
<body>
<div class="card">
  <div class="bg-decor">
    <div class="bg-ruler"></div><div class="bg-ruler-bottom"></div><div class="bg-lines"></div>
    <div class="bg-sparkle" style="width:9px;height:9px;top:15%;left:8%;opacity:0.38;"></div>
    <div class="bg-sparkle" style="width:6px;height:6px;top:22%;right:12%;opacity:0.3;"></div>
    <div class="gold-blob-tr"></div><div class="gold-blob-bl"></div>
    <svg class="bg-star" style="top:8%;left:45%;width:14px;height:14px;" viewBox="0 0 20 20" fill="#f9d84a"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
  </div>
  <div class="header">
    <div class="logo-circle">
      <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="#1a6b1a" stroke-width="2.5"/>
        <path d="M20 8 L22 16 L30 16 L24 21 L26 29 L20 24 L14 29 L16 21 L10 16 L18 16 Z" fill="#f5c842"/>
      </svg>
    </div>
    <div class="header-text">
      <div class="assoc-name">Vocational and Technical Education Students Association</div>
      <div class="university">Ekiti State University, Ado Ekiti</div>
    </div>
  </div>
  <hr class="divider-dots">
  <div class="title-section">
    <div class="script-title">The Achievers 26'</div>
    <div class="class-badge">Class of 26</div>
  </div>
  <div class="body">
    <div class="left-col">
      <div class="meet-badge">
        <span class="meet-line">MEET</span>
        <div class="the-finalist-row">
          <span class="the-pill">the</span>
          <span class="finalist-line">FINALIST</span>
        </div>
      </div>
      <div class="photo-frame-wrap">
        <div class="photo-frame">
          <div class="photo-inner">${photoInner}</div>
          <div class="photo-caption">
            <span class="photo-caption-label">Social media Handle:</span>
            <span class="photo-caption-value">${esc(data.socialHandle)}</span>
          </div>
        </div>
      </div>
      <div class="name-badge-wrap"><div class="name-badge"><div class="full-name">${esc(data.fullName)}</div></div></div>
      <div class="nickname-badge-wrap"><div class="nickname-badge"><span>${esc(data.nickname)}</span></div></div>
    </div>
    <div class="right-col">
      <div class="right-col-inner">
        <div class="stat-row"><span class="stat-label">Best Level:</span><span class="stat-value">${esc(data.bestLevel)}</span></div>
        <div class="stat-row"><span class="stat-label">Worst Level:</span><span class="stat-value">${esc(data.worstLevel)}</span></div>
        <div class="stat-row"><span class="stat-label">Best Course:</span><span class="stat-value">${esc(data.bestCourse)}</span></div>
        <div class="stat-row"><span class="stat-label">Worst Course:</span><span class="stat-value">${esc(data.worstCourse)}</span></div>
        <div class="stat-row"><span class="stat-label">Favourite Lecturer:</span><span class="stat-value">${esc(data.favLecturer)}</span></div>
        <div class="stat-row"><span class="stat-label">Class Crush:</span><span class="stat-value">${esc(data.classCrush)}</span></div>
        <div class="stat-row"><span class="stat-label">Relationship Status:</span><span class="stat-value" style="font-style:italic;">${esc(data.relStatus)}</span></div>
        <div class="quote-row"><div class="quote-label">Favourite Quote:</div><div class="quote-text">${esc(data.favQuote)}</div></div>
        <div class="stat-row"><span class="stat-label">If not VTE, What Else:</span><span class="stat-value">${esc(data.ifNotVte)}</span></div>
        <div class="exp-block"><div class="exp-label">Best Experience in School:</div><div class="exp-value">${esc(data.bestExp)}</div></div>
        <div class="exp-block"><div class="exp-label">Worst Experience in School:</div><div class="exp-value">${esc(data.worstExp)}</div></div>
        <div class="stat-row"><span class="stat-label">D.O.B:</span><span class="stat-value">${dob}</span></div>
        <div class="stat-row"><span class="stat-label">State of Origin:</span><span class="stat-value">${esc(data.stateOfOrigin)}</span></div>
        <div class="stat-row"><span class="stat-label">Hobbies:</span><span class="stat-value">${esc(data.hobbies)}</span></div>
      </div>
    </div>
  </div>
  <div class="footer-space"></div>
</div>
</body>
</html>`;
}

// ── Send email ────────────────────────────────────────────────────────────────
async function sendEmail(fullName, cardHTML) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-pulse.com',
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"Achievers 26' Cards" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Finalist Card — ${fullName}`,
    text: `A new finalist card has been submitted by ${fullName}.`,
    html: cardHTML,
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/submit', upload.single('photo'), async (req, res) => {
  try {
    const data = req.body;
    let photoBase64 = null;
    let mime = 'image/jpeg';
    if (req.file) {
      const buf = fs.readFileSync(req.file.path);
      photoBase64 = buf.toString('base64');
      mime = req.file.mimetype || 'image/jpeg';
      fs.unlinkSync(req.file.path);
    }
    const cardHTML = buildCardHTML(data, photoBase64, mime);
    let emailSent = true;
    try {
      await sendEmail(data.fullName, cardHTML);
    } catch (emailErr) {
      console.error('Email failed:', emailErr.message);
      emailSent = false;
    }
    res.json({ ok: true, cardHTML, name: data.fullName, emailSent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`\n✅  Achievers 26' server running → http://localhost:${PORT}\n`));
