const crypto = require('crypto');
require('dotenv').config();
const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Pre-load logos as base64 so html2canvas never needs to fetch them ─────────
function loadLogoBase64(filename) {
  try {
    const p = path.join(__dirname, 'public', filename);
    if (fs.existsSync(p)) return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  } catch(e) {}
  return '';
}
const EKSU_LOGO_B64  = loadLogoBase64('eksu-logo.png');
const VTESA_LOGO_B64 = loadLogoBase64('vtesa-logo.png');

// ── Uploads folder ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ── Temp cards store — disk-backed so server restarts don't wipe them ────────
const cardsDir = path.join(__dirname, 'cards');
if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir);

function saveCard(html, name) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const file = path.join(cardsDir, `${token}.json`);
  fs.writeFileSync(file, JSON.stringify({ html, name, expires }));
  // Schedule cleanup
  setTimeout(() => { try { fs.unlinkSync(file); } catch(e) {} }, 24 * 60 * 60 * 1000);
  return token;
}

function getCard(token) {
  // Sanitize token — only hex chars allowed
  if (!/^[a-f0-9]+$/.test(token)) return null;
  const file = path.join(cardsDir, `${token}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() > entry.expires) { fs.unlinkSync(file); return null; }
    return entry;
  } catch(e) { return null; }
}

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
    ? `<img src="${photoSrc}" alt="Photo">`
    : `<div class="photo-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg><span>Upload photo<br>of student</span></div>`;
  const dob = `${ordinal(parseInt(data.dobDay))} of ${MONTHS[parseInt(data.dobMonth) - 1]}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>The Achievers 26' – ${esc(data.fullName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Bebas+Neue&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; font-family: 'Montserrat', sans-serif; padding: 16px; }
  .card { width: 100%; max-width: 520px; background: linear-gradient(160deg, #1e6b1e 0%, #0e4a0e 35%, #0a3a0a 65%, #1a5c1a 100%); border-radius: 18px; overflow: hidden; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
  .bg-decor { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .bg-ruler { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: repeating-linear-gradient(90deg, transparent 0px, transparent 8px, rgba(245,200,66,0.28) 8px, rgba(245,200,66,0.28) 10px); }
  .bg-ruler-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: repeating-linear-gradient(90deg, transparent 0px, transparent 8px, rgba(245,200,66,0.22) 8px, rgba(245,200,66,0.22) 10px); }
  .bg-lines { position: absolute; inset: 0; background-image: repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.013) 40px, rgba(255,255,255,0.013) 41px); }
  .bg-sparkle { position: absolute; border-radius: 50%; background: radial-gradient(circle, #f9d84a 0%, transparent 70%); }
  .gold-blob-tr { position: absolute; top: -15px; right: -15px; width: 140px; height: 140px; background: radial-gradient(ellipse at 40% 40%, #f9d84a 0%, #d4a017 45%, #8a6000 85%, transparent 100%); border-radius: 50% 20% 60% 30%; opacity: 0.95; z-index: 1; }
  .gold-blob-bl { position: absolute; bottom: -20px; left: -20px; width: 160px; height: 160px; background: radial-gradient(ellipse at 40% 40%, #f9d84a 0%, #d4a017 45%, #8a6000 85%, transparent 100%); border-radius: 40% 60% 30% 70%; opacity: 0.9; z-index: 1; }
  .gold-blob-br { position: absolute; bottom: -10px; right: -10px; width: 105px; height: 85px; background: radial-gradient(ellipse at center, #f9d84a 0%, #d4a017 50%, transparent 100%); border-radius: 60% 30% 50% 40%; opacity: 0.7; z-index: 1; }
  .bg-gear-tl { position: absolute; top: 60px; left: -40px; width: 140px; height: 140px; opacity: 0.09; }
  .bg-gear-mr { position: absolute; top: 44%; right: -28px; width: 110px; height: 110px; opacity: 0.1; }
  .bg-gear-bl2 { position: absolute; bottom: 130px; left: 16px; width: 75px; height: 75px; opacity: 0.1; }
  .bg-compass { position: absolute; top: 38%; left: 4%; width: 65px; height: 65px; opacity: 0.09; }
  .bg-triangle { position: absolute; top: 22%; right: 2%; width: 55px; height: 55px; opacity: 0.1; }
  .bg-wrench { position: absolute; top: 58%; left: 2%; width: 42px; height: 42px; opacity: 0.09; }
  .bg-book { position: absolute; top: 13%; right: 5%; width: 48px; height: 48px; opacity: 0.09; }
  .bg-diploma { position: absolute; bottom: 16%; right: 3%; width: 42px; height: 42px; opacity: 0.1; }
  .bg-cap { position: absolute; top: 29%; right: 2%; width: 36px; height: 36px; opacity: 0.09; }
  .bg-pencil { position: absolute; bottom: 28%; left: 3%; width: 38px; height: 38px; opacity: 0.09; }
  .bg-dna { position: absolute; top: 72%; right: 5%; width: 34px; height: 60px; opacity: 0.08; }
  .bg-star { position: absolute; opacity: 0.18; }
  .bg-protractor { position: absolute; top: 52px; left: 8px; width: 90px; height: 50px; opacity: 0.10; }
  .bg-hammer { position: absolute; bottom: 110px; left: 6px; width: 50px; height: 60px; opacity: 0.10; }
  .bg-certificate { position: absolute; top: 42%; left: 8px; width: 58px; height: 48px; opacity: 0.10; }
  .bg-medal { position: absolute; top: 40%; right: 6px; width: 44px; height: 58px; opacity: 0.11; }
  .bg-lightning { position: absolute; top: 8px; right: 48px; width: 28px; height: 52px; opacity: 0.11; }
  .bg-grid { position: absolute; inset: 0; opacity: 0.03; background-image: linear-gradient(rgba(245,200,66,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.8) 1px, transparent 1px); background-size: 20px 20px; }
  .bg-vtesa { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-family: 'Bebas Neue', 'Arial Black', sans-serif; font-size: 110px; font-weight: 900; color: rgba(255,255,255,0.06); letter-spacing: 0.12em; white-space: nowrap; pointer-events: none; user-select: none; line-height: 1; }
  .header { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 14px 14px 8px; }
  .logos { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .logo-circle { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 2px solid #f5c842; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  .header-text { flex: 1; min-width: 0; }
  .assoc-name { font-size: clamp(8px, 2.2vw, 11px); font-weight: 800; color: #fff; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.25; }
  .university { font-size: clamp(8px, 2vw, 10px); font-weight: 700; color: #f5c842; letter-spacing: 0.05em; text-transform: uppercase; }
  .divider-dots { border: none; border-top: 2px dashed rgba(245,200,66,0.4); margin: 0 14px 4px; position: relative; z-index: 2; }
  .title-section { position: relative; z-index: 2; text-align: center; padding: 6px 14px 4px; }
  .script-title { font-family: 'Dancing Script', cursive; font-size: clamp(34px, 10vw, 52px); color: #fff; line-height: 1.1; text-shadow: 0 0 20px rgba(255,230,100,0.9), 0 0 50px rgba(255,220,60,0.6), 0 0 80px rgba(255,200,0,0.3), 2px 2px 8px rgba(0,0,0,0.5); }
  .class-badge { display: inline-block; background: linear-gradient(135deg, #0a3a0a 0%, #1a6b1a 40%, #0e4a0e 60%, #0a3a0a 100%); color: #f5c842; font-size: clamp(10px, 2.8vw, 14px); font-weight: 900; letter-spacing: 0.1em; padding: 4px 22px; border-radius: 20px; margin-top: 3px; text-transform: uppercase; border: 2px solid #f5c842; box-shadow: 0 0 0 1px #d4a017, 0 2px 14px rgba(212,160,23,0.5); text-shadow: 0 0 8px rgba(245,200,66,0.6); }
  .body { position: relative; z-index: 2; display: flex; gap: 10px; padding: 10px 14px 0; align-items: flex-start; }
  .left-col { width: clamp(180px, 50%, 240px); flex-shrink: 0; display: flex; flex-direction: column; align-items: center; position: relative; border-radius: 10px; overflow: hidden; }
  .left-col::before { content: ''; position: absolute; inset: -10px; z-index: 0; border-left: 2px solid rgba(245,200,66,0.35); border-right: 1px solid rgba(245,200,66,0.15); background: radial-gradient(ellipse 80% 60% at 50% 30%, rgba(245,200,66,0.18) 0%, transparent 65%), radial-gradient(ellipse 60% 80% at 20% 80%, rgba(245,200,66,0.12) 0%, transparent 60%), repeating-linear-gradient(-45deg, transparent 0px, transparent 14px, rgba(255,255,255,0.025) 14px, rgba(255,255,255,0.025) 15px), repeating-linear-gradient(45deg, transparent 0px, transparent 28px, rgba(245,200,66,0.04) 28px, rgba(245,200,66,0.04) 29px); pointer-events: none; }
  .left-col::after { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle 1px at center, rgba(245,200,66,0.35) 0%, transparent 100%); background-size: 18px 18px; pointer-events: none; opacity: 0.5; }
  .left-col > * { position: relative; z-index: 1; }
  .meet-badge { align-self: flex-start; margin-bottom: 6px; line-height: 1; }
  .meet-line { font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 10vw, 56px); color: #fff; line-height: 0.9; display: block; font-style: italic; text-shadow: 4px 4px 0px rgba(0,0,0,0.6), -1px -1px 0 rgba(0,0,0,0.3), 0 0 25px rgba(255,255,255,0.2); letter-spacing: 0.05em; -webkit-text-stroke: 0.5px rgba(245,200,66,0.4); }
  .the-finalist-row { display: flex; align-items: center; gap: 4px; line-height: 1; }
  .the-pill { display: inline-flex; align-items: center; justify-content: center; background: #f5c842; color: #111; font-size: clamp(9px, 2.2vw, 12px); font-weight: 900; padding: 3px 7px; border-radius: 4px; text-transform: lowercase; font-family: 'Montserrat', sans-serif; margin-bottom: 1px; }
  .finalist-line { font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 10vw, 56px); color: #fff; line-height: 0.9; display: block; font-style: italic; text-shadow: 4px 4px 0px rgba(0,0,0,0.6), -1px -1px 0 rgba(0,0,0,0.3), 0 0 25px rgba(255,255,255,0.2); letter-spacing: 0.05em; -webkit-text-stroke: 0.5px rgba(245,200,66,0.4); }
  .photo-frame-wrap { width: 100%; position: relative; padding: 4px; }
  .photo-frame { width: 100%; aspect-ratio: 3 / 4; position: relative; background: #fff; padding: 8px 8px 0px 8px; transform: rotate(-2.5deg); box-shadow: 4px 4px 18px rgba(0,0,0,0.7), -2px -2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15); clip-path: polygon(0% 1%,3% 0%,6% 1.5%,10% 0%,13% 1%,17% 0%,20% 1.5%,24% 0.5%,27% 0%,31% 1%,35% 0%,39% 1.5%,43% 0%,47% 1%,51% 0%,55% 1.5%,59% 0%,63% 1%,67% 0%,71% 1.5%,75% 0%,79% 1%,83% 0%,87% 1.5%,91% 0%,95% 1%,98% 0.5%,100% 0%,100% 0%,99% 3%,100% 7%,99.5% 12%,100% 17%,99% 22%,100% 27%,99.5% 32%,100% 37%,99% 42%,100% 47%,99.5% 52%,100% 57%,99% 62%,100% 67%,99.5% 72%,100% 77%,99% 82%,100% 87%,99.5% 92%,100% 97%,99% 100%,99% 100%,95% 99%,91% 100%,87% 98.5%,83% 100%,79% 99%,75% 100%,71% 98.5%,67% 100%,63% 99%,59% 100%,55% 98.5%,51% 100%,47% 99%,43% 100%,39% 98.5%,35% 100%,31% 99%,27% 100%,23% 98.5%,19% 100%,15% 99%,11% 100%,7% 98.5%,3% 100%,0% 100%,0% 100%,1% 97%,0% 92%,1% 87%,0% 82%,1% 77%,0% 72%,1% 67%,0% 62%,1% 57%,0% 52%,1% 47%,0% 42%,1% 37%,0% 32%,1% 27%,0% 22%,1% 17%,0% 12%,1% 7%,0% 2%); display: flex; flex-direction: column; }
  .photo-inner { width: 100%; flex: 1; min-height: 0; overflow: hidden; background: linear-gradient(160deg, #3a8a3a, #1a5a1a); border-radius: 1px; position: relative; }
  .photo-inner img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
  .photo-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(160deg, #3a8a3a, #1a5a1a); color: rgba(255,255,255,0.5); gap: 8px; }
  .photo-placeholder svg { opacity: 0.45; width: 72px; height: 72px; }
  .photo-placeholder span { font-size: 11px; text-align: center; padding: 0 8px; line-height: 1.5; }
  .photo-caption { background: #fff; width: 100%; text-align: center; padding: 5px 6px 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 3px; }
  .photo-caption-label { font-size: clamp(7px, 1.7vw, 9px); color: #555; font-weight: 700; font-style: italic; display: inline-block; transform: skewX(-10deg); white-space: nowrap; }
  .photo-caption-value { font-size: clamp(8px, 2vw, 11px); color: #111; font-weight: 900; font-style: italic; display: inline-block; transform: skewX(-10deg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
  .name-badge-wrap { margin-top: 8px; width: 100%; padding: 2.5px; background: linear-gradient(90deg, #f5c842, #d4a017, #f5c842); clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%); box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
  .name-badge { background: linear-gradient(90deg, #3aaa3a, #1a7a1a); padding: 5px 8px; text-align: center; width: 100%; clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); }
  .full-name { font-size: clamp(9px, 2.4vw, 13px); font-weight: 900; color: #fffde7; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2; text-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 8px rgba(245,200,66,0.3); word-break: break-word; }
  .nickname-badge-wrap { margin-top: 4px; width: 100%; padding: 2.5px; background: linear-gradient(90deg, #1a5c1a, #0e3d0e, #1a5c1a); clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%); }
  .nickname-badge { background: linear-gradient(90deg, #f5c842, #e8b820); padding: 4px 8px; width: 100%; text-align: center; clip-path: polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); }
  .nickname-badge span { font-size: clamp(9px, 2.3vw, 13px); font-weight: 900; color: #1a1a00; letter-spacing: 0.12em; text-transform: uppercase; word-break: break-word; }
  .right-col { flex: 1; min-width: 0; display: flex; flex-direction: column; padding-top: 2px; }
  .right-col-inner { display: flex; flex-direction: column; gap: 0; }
  .stat-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; gap: 4px; position: relative; }
  .stat-row::after { content:''; display:block; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.6) 20%, #f5c842 50%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.05) 100%); }
  .stat-label { font-size: clamp(7px, 1.8vw, 10px); color: #cce8cc; font-weight: 600; white-space: normal; flex-shrink: 0; max-width: 60%; }
  .stat-value { font-size: clamp(8px, 2vw, 11px); color: #fff; font-weight: 800; text-align: right; word-break: break-word; max-width: 45%; }
  .quote-row { padding: 4px 0; position: relative; }
  .quote-row::after { content:''; display:block; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.6) 20%, #f5c842 50%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.05) 100%); }
  .quote-label { font-size: clamp(7.5px, 1.9vw, 10px); color: #cce8cc; font-weight: 600; }
  .quote-text { font-size: clamp(7.5px, 1.9vw, 10px); color: #fff; font-weight: 700; line-height: 1.4; margin-top: 1px; }
  .exp-block { padding: 4px 0; position: relative; }
  .exp-block::after { content:''; display:block; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.6) 20%, #f5c842 50%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.05) 100%); }
  .exp-label { font-size: clamp(7.5px, 1.8vw, 10px); color: #cce8cc; font-weight: 600; line-height: 1.3; }
  .exp-value { font-size: clamp(8px, 2vw, 11px); color: #fff; font-weight: 800; margin-top: 1px; }
  .footer-space { height: 26px; position: relative; z-index: 2; }
  @media (min-width: 480px) { .card { max-width: 560px; } }
  @media (max-width: 400px) { .body { gap: 7px; padding: 8px 10px 0; } .left-col { width: clamp(160px, 48%, 200px); } }
  @media (max-width: 320px) { .left-col { width: 150px; } }
</style>
</head>
<body>
<div class="card" id="the-card">
  <div class="bg-decor">
    <div class="bg-ruler"></div>
    <div class="bg-ruler-bottom"></div>
    <div class="bg-lines"></div>
    <div class="bg-sparkle" style="width:9px;height:9px;top:15%;left:8%;opacity:0.38;"></div>
    <div class="bg-sparkle" style="width:6px;height:6px;top:22%;right:12%;opacity:0.3;"></div>
    <div class="bg-sparkle" style="width:7px;height:7px;top:55%;left:35%;opacity:0.22;"></div>
    <div class="bg-sparkle" style="width:8px;height:8px;top:70%;right:8%;opacity:0.28;"></div>
    <div class="bg-sparkle" style="width:5px;height:5px;top:85%;left:55%;opacity:0.25;"></div>
    <div class="bg-sparkle" style="width:10px;height:10px;top:48%;left:60%;opacity:0.15;"></div>
    <div class="gold-blob-tr"></div>
    <div class="gold-blob-bl"></div>
    <div class="gold-blob-br"></div>
    <svg class="bg-star" style="top:8%;left:45%;width:14px;height:14px;" viewBox="0 0 20 20" fill="#f9d84a"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
    <svg class="bg-star" style="top:62%;left:30%;width:10px;height:10px;opacity:0.2;" viewBox="0 0 20 20" fill="#f9d84a"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
    <svg class="bg-star" style="top:35%;right:14%;width:11px;height:11px;opacity:0.22;" viewBox="0 0 20 20" fill="#fff"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
    <svg class="bg-star" style="top:80%;left:18%;width:12px;height:12px;opacity:0.2;" viewBox="0 0 20 20" fill="#f9d84a"><path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z"/></svg>
    <svg class="bg-gear-tl" viewBox="0 0 100 100" fill="#f5c842"><path d="M43.3 5.8l-2.4 8.2c-2.3.6-4.5 1.5-6.5 2.7l-7.8-3.6-9.3 9.3 3.6 7.8c-1.2 2-2.1 4.2-2.7 6.5l-8.2 2.4v13.1l8.2 2.4c.6 2.3 1.5 4.5 2.7 6.5l-3.6 7.8 9.3 9.3 7.8-3.6c2 1.2 4.2 2.1 6.5 2.7l2.4 8.2h13.1l2.4-8.2c2.3-.6 4.5-1.5 6.5-2.7l7.8 3.6 9.3-9.3-3.6-7.8c1.2-2 2.1-4.2 2.7-6.5l8.2-2.4V43.3l-8.2-2.4c-.6-2.3-1.5-4.5-2.7-6.5l3.6-7.8-9.3-9.3-7.8 3.6c-2-1.2-4.2-2.1-6.5-2.7L56.7 5.8H43.3zm6.6 25.4c10.4 0 18.8 8.4 18.8 18.8S60.4 68.8 50 68.8 31.3 60.4 31.3 50 39.6 31.3 50 31.3z"/><circle cx="50" cy="50" r="10" fill="none" stroke="#f5c842" stroke-width="4"/></svg>
    <svg class="bg-gear-mr" viewBox="0 0 100 100" fill="#f5c842"><path d="M43.3 5.8l-2.4 8.2c-2.3.6-4.5 1.5-6.5 2.7l-7.8-3.6-9.3 9.3 3.6 7.8c-1.2 2-2.1 4.2-2.7 6.5l-8.2 2.4v13.1l8.2 2.4c.6 2.3 1.5 4.5 2.7 6.5l-3.6 7.8 9.3 9.3 7.8-3.6c2 1.2 4.2 2.1 6.5 2.7l2.4 8.2h13.1l2.4-8.2c2.3-.6 4.5-1.5 6.5-2.7l7.8 3.6 9.3-9.3-3.6-7.8c1.2-2 2.1-4.2 2.7-6.5l8.2-2.4V43.3l-8.2-2.4c-.6-2.3-1.5-4.5-2.7-6.5l3.6-7.8-9.3-9.3-7.8 3.6c-2-1.2-4.2-2.1-6.5-2.7L56.7 5.8H43.3zm6.6 25.4c10.4 0 18.8 8.4 18.8 18.8S60.4 68.8 50 68.8 31.3 60.4 31.3 50 39.6 31.3 50 31.3z"/></svg>
    <svg class="bg-gear-bl2" viewBox="0 0 100 100" fill="#ffffff"><path d="M43.3 5.8l-2.4 8.2c-2.3.6-4.5 1.5-6.5 2.7l-7.8-3.6-9.3 9.3 3.6 7.8c-1.2 2-2.1 4.2-2.7 6.5l-8.2 2.4v13.1l8.2 2.4c.6 2.3 1.5 4.5 2.7 6.5l-3.6 7.8 9.3 9.3 7.8-3.6c2 1.2 4.2 2.1 6.5 2.7l2.4 8.2h13.1l2.4-8.2c2.3-.6 4.5-1.5 6.5-2.7l7.8 3.6 9.3-9.3-3.6-7.8c1.2-2 2.1-4.2 2.7-6.5l8.2-2.4V43.3l-8.2-2.4c-.6-2.3-1.5-4.5-2.7-6.5l3.6-7.8-9.3-9.3-7.8 3.6c-2-1.2-4.2-2.1-6.5-2.7L56.7 5.8H43.3zm6.6 25.4c10.4 0 18.8 8.4 18.8 18.8S60.4 68.8 50 68.8 31.3 60.4 31.3 50 39.6 31.3 50 31.3z"/></svg>
    <svg class="bg-compass" viewBox="0 0 100 100" fill="none" stroke="#f5c842" stroke-width="2"><circle cx="50" cy="50" r="45" stroke-opacity="0.5"/><circle cx="50" cy="50" r="5" fill="#f5c842" fill-opacity="0.4"/><line x1="50" y1="5" x2="50" y2="95" stroke-opacity="0.6"/><line x1="5" y1="50" x2="95" y2="50" stroke-opacity="0.6"/><polygon points="50,5 44,25 50,20 56,25" fill="#f5c842" fill-opacity="0.6"/><polygon points="50,95 44,75 50,80 56,75" fill="#f5c842" fill-opacity="0.35"/><polygon points="5,50 25,44 20,50 25,56" fill="#f9d84a" fill-opacity="0.4"/><polygon points="95,50 75,44 80,50 75,56" fill="#f9d84a" fill-opacity="0.25"/></svg>
    <svg class="bg-triangle" viewBox="0 0 80 80" fill="none" stroke="#f5c842" stroke-width="2.5"><polygon points="5,75 75,75 75,5" fill="rgba(245,200,66,0.06)" stroke="#f5c842" stroke-opacity="0.7"/><path d="M68 75 L68 68 L75 68" fill="none" stroke="#f9d84a" stroke-width="2" stroke-opacity="0.6"/><line x1="75" y1="15" x2="70" y2="15" stroke-opacity="0.5"/><line x1="75" y1="25" x2="70" y2="25" stroke-opacity="0.5"/><line x1="75" y1="35" x2="70" y2="35" stroke-opacity="0.5"/><line x1="75" y1="45" x2="70" y2="45" stroke-opacity="0.5"/><line x1="75" y1="55" x2="70" y2="55" stroke-opacity="0.5"/></svg>
    <svg class="bg-wrench" viewBox="0 0 100 100" fill="#f5c842"><path d="M78.5 21.5c-4.5-4.5-10.7-5.8-16.4-3.9l9.2 9.2-6.4 6.4-9.2-9.2c-1.9 5.7-.6 11.9 3.9 16.4 4.3 4.3 10.2 5.7 15.7 4.1L93.5 62.7c2.2 2.2 2.2 5.8 0 8-2.2 2.2-5.8 2.2-8 0L67.3 52.5c-1.6 5.5-.2 11.4 4.1 15.7 4.5 4.5 10.7 5.8 16.4 3.9l-9.2-9.2 6.4-6.4 9.2 9.2c1.9-5.7.6-11.9-3.9-16.4-4.5-4.5-10.9-5.8-16.7-3.7L55.4 27.5c1.7-5.8.4-12.1-4.1-16.6-4.5-4.5-10.7-5.8-16.4-3.9l9.2 9.2-6.4 6.4-9.2-9.2c-1.9 5.7-.6 11.9 3.9 16.4 4.3 4.3 10.2 5.7 15.7 4.1l15.5 15.5-3.5 3.5L44.6 37.4c-5.5 1.6-11.4.2-15.7-4.1-4.5-4.5-5.8-10.7-3.9-16.4l-9.2 9.2-6.4-6.4 9.2-9.2c-5.7 1.9-11.9 5.4-16.4 9.9-4.5 4.5-5.8 10.7-3.9 16.4"/></svg>
    <svg class="bg-book" viewBox="0 0 100 100" fill="#f5c842"><path d="M10 20 L10 85 Q10 88 13 88 L50 80 L87 88 Q90 88 90 85 L90 20 Q90 17 87 17 L53 10 Q50 9 47 10 L13 17 Q10 17 10 20z" fill-opacity="0.5"/><line x1="50" y1="10" x2="50" y2="80" stroke="#0a3a0a" stroke-width="3"/><line x1="18" y1="35" x2="44" y2="33" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.7"/><line x1="18" y1="45" x2="44" y2="43" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.7"/><line x1="56" y1="33" x2="82" y2="35" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.7"/><line x1="56" y1="43" x2="82" y2="45" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.7"/></svg>
    <svg class="bg-diploma" viewBox="0 0 100 100" fill="#f5c842"><rect x="12" y="15" width="76" height="60" rx="5" fill-opacity="0.45"/><rect x="12" y="15" width="76" height="60" rx="5" fill="none" stroke="#f9d84a" stroke-width="3" stroke-opacity="0.7"/><line x1="26" y1="33" x2="74" y2="33" stroke="#0a3a0a" stroke-width="3.5"/><line x1="26" y1="44" x2="74" y2="44" stroke="#0a3a0a" stroke-width="3.5"/><line x1="26" y1="55" x2="55" y2="55" stroke="#0a3a0a" stroke-width="3.5"/><circle cx="50" cy="87" r="13" fill="#d4a017" fill-opacity="0.9"/><circle cx="50" cy="87" r="9" fill="none" stroke="#f9d84a" stroke-width="1.5"/></svg>
    <svg class="bg-cap" viewBox="0 0 100 100" fill="#f5c842"><polygon points="50,10 96,37 50,64 4,37" fill-opacity="0.55"/><polygon points="50,10 96,37 50,64 4,37" fill="none" stroke="#f9d84a" stroke-width="2.5" stroke-opacity="0.7"/><path d="M78 47 L78 72 Q64 87 50 82 Q36 87 22 72 L22 47" fill="none" stroke="#f5c842" stroke-width="4.5" stroke-opacity="0.65"/><line x1="96" y1="37" x2="96" y2="62" stroke="#f5c842" stroke-width="4" stroke-opacity="0.7"/><circle cx="96" cy="65" r="5.5" fill="#d4a017" fill-opacity="0.9"/></svg>
    <svg class="bg-pencil" viewBox="0 0 100 100" fill="none"><rect x="40" y="5" width="22" height="75" rx="4" fill="#f5c842" fill-opacity="0.5" stroke="#f9d84a" stroke-width="2" stroke-opacity="0.7"/><polygon points="40,80 62,80 51,100" fill="#d4a017" fill-opacity="0.65"/><line x1="40" y1="18" x2="62" y2="18" stroke="#0a3a0a" stroke-width="2.5"/><rect x="40" y="5" width="22" height="12" rx="3" fill="#f9d84a" fill-opacity="0.75"/></svg>
    <svg class="bg-dna" viewBox="0 0 40 80" fill="none" stroke="#f5c842" stroke-width="2" stroke-opacity="0.6"><path d="M8 5 Q20 20 32 35 Q20 50 8 65" fill="none"/><path d="M32 5 Q20 20 8 35 Q20 50 32 65" fill="none"/><line x1="10" y1="17" x2="30" y2="17" stroke="#d4a017" stroke-opacity="0.5"/><line x1="9" y1="27" x2="31" y2="27" stroke="#d4a017" stroke-opacity="0.5"/><line x1="14" y1="35" x2="26" y2="35" stroke="#d4a017" stroke-opacity="0.5"/><line x1="9" y1="43" x2="31" y2="43" stroke="#d4a017" stroke-opacity="0.5"/><line x1="10" y1="53" x2="30" y2="53" stroke="#d4a017" stroke-opacity="0.5"/></svg>
    <svg style="position:absolute;top:5%;left:50%;transform:translateX(-50%);width:60px;height:36px;opacity:0.13;" viewBox="0 0 120 72" fill="none"><path d="M10 36 Q5 20 15 10 Q25 2 35 8 Q28 18 24 28 Q20 36 18 42z" fill="#f9d84a"/><path d="M22 36 Q18 22 26 14 Q34 6 42 12 Q36 22 33 32 Q30 40 28 46z" fill="#d4a017"/><path d="M110 36 Q115 20 105 10 Q95 2 85 8 Q92 18 96 28 Q100 36 102 42z" fill="#f9d84a"/><path d="M98 36 Q102 22 94 14 Q86 6 78 12 Q84 22 87 32 Q90 40 92 46z" fill="#d4a017"/><path d="M55 60 Q48 68 60 70 Q72 68 65 60 Q62 55 60 50 Q58 55 55 60z" fill="#f9d84a"/></svg>
    <svg style="position:absolute;top:52%;right:3%;width:32px;height:32px;opacity:0.12;" viewBox="0 0 100 100" fill="#f9d84a"><path d="M50 10 C30 10 18 25 18 40 C18 55 28 63 32 70 L32 80 Q32 85 38 85 L62 85 Q68 85 68 80 L68 70 C72 63 82 55 82 40 C82 25 70 10 50 10z" fill-opacity="0.45"/><rect x="38" y="85" width="24" height="6" rx="3" fill="#d4a017" fill-opacity="0.6"/><rect x="41" y="91" width="18" height="5" rx="2.5" fill="#f9d84a" fill-opacity="0.5"/></svg>

    <!-- Grid overlay -->
    <div class="bg-grid"></div>

    <!-- VTESA watermark — inline styles so html2canvas captures it reliably -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Arial Black',sans-serif;font-size:110px;font-weight:900;color:rgba(255,255,255,0.07);letter-spacing:0.1em;white-space:nowrap;pointer-events:none;user-select:none;line-height:1;z-index:1;">VTESA</div>

    <!-- Protractor top-left -->
    <svg class="bg-protractor" viewBox="0 0 180 100" fill="none" stroke="#f5c842" stroke-width="2">
      <path d="M10 90 A80 80 0 0 1 170 90" stroke-opacity="0.7"/>
      <line x1="90" y1="90" x2="90" y2="10" stroke-opacity="0.5"/>
      <line x1="90" y1="90" x2="170" y2="90" stroke-opacity="0.5"/>
      <line x1="90" y1="90" x2="10" y2="90" stroke-opacity="0.5"/>
      <line x1="90" y1="90" x2="34" y2="33" stroke-opacity="0.3"/>
      <line x1="90" y1="90" x2="146" y2="33" stroke-opacity="0.3"/>
      <text x="82" y="105" fill="#f5c842" font-size="10" fill-opacity="0.6" font-family="Arial">0°</text>
      <text x="165" y="95" fill="#f5c842" font-size="10" fill-opacity="0.6" font-family="Arial">90</text>
    </svg>

    <!-- Hammer & chisel bottom-left -->
    <svg class="bg-hammer" viewBox="0 0 50 70" fill="none">
      <rect x="18" y="5" width="14" height="22" rx="2" fill="#f5c842" fill-opacity="0.45" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.6"/>
      <rect x="22" y="27" width="6" height="38" rx="2" fill="#d4a017" fill-opacity="0.5" stroke="#f5c842" stroke-width="1" stroke-opacity="0.5"/>
      <line x1="5" y1="55" x2="45" y2="35" stroke="#f9d84a" stroke-width="3" stroke-opacity="0.5" stroke-linecap="round"/>
      <rect x="30" y="29" width="18" height="10" rx="2" fill="#f5c842" fill-opacity="0.5" transform="rotate(-30 30 29)"/>
    </svg>

    <!-- Certificate scroll mid-left -->
    <svg class="bg-certificate" viewBox="0 0 58 48" fill="none">
      <rect x="4" y="6" width="50" height="36" rx="3" fill="#f5c842" fill-opacity="0.25" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.65"/>
      <ellipse cx="4" cy="24" rx="4" ry="18" fill="#d4a017" fill-opacity="0.4" stroke="#f5c842" stroke-width="1" stroke-opacity="0.5"/>
      <ellipse cx="54" cy="24" rx="4" ry="18" fill="#d4a017" fill-opacity="0.4" stroke="#f5c842" stroke-width="1" stroke-opacity="0.5"/>
      <line x1="12" y1="16" x2="46" y2="16" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.6"/>
      <line x1="12" y1="22" x2="46" y2="22" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.6"/>
      <line x1="12" y1="28" x2="35" y2="28" stroke="#f9d84a" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="29" cy="40" r="5" fill="#d4a017" fill-opacity="0.7" stroke="#f5c842" stroke-width="1" stroke-opacity="0.6"/>
    </svg>

    <!-- Gold medal mid-right -->
    <svg class="bg-medal" viewBox="0 0 44 58" fill="none">
      <rect x="18" y="0" width="8" height="20" rx="1" fill="#f5c842" fill-opacity="0.4" stroke="#d4a017" stroke-width="1" stroke-opacity="0.5"/>
      <polygon points="14,0 22,8 30,0" fill="#d4a017" fill-opacity="0.5"/>
      <circle cx="22" cy="38" r="18" fill="#d4a017" fill-opacity="0.35" stroke="#f9d84a" stroke-width="2" stroke-opacity="0.7"/>
      <circle cx="22" cy="38" r="12" fill="none" stroke="#f5c842" stroke-width="1" stroke-opacity="0.5"/>
      <text x="16" y="42" fill="#f9d84a" font-size="10" font-weight="bold" fill-opacity="0.7" font-family="Arial">1st</text>
    </svg>

    <!-- Lightning bolt top-right -->
    <svg class="bg-lightning" viewBox="0 0 28 52" fill="#f9d84a">
      <polygon points="16,2 4,28 14,28 12,50 24,22 14,22" fill-opacity="0.55" stroke="#f5c842" stroke-width="1" stroke-opacity="0.6"/>
    </svg>

  </div>
  <div class="header">
    <div class="logos">
      <!-- Logo 1: EKSU first -->
      <div class="logo-circle">
        <img src="${EKSU_LOGO_B64}" alt="EKSU" style="width:36px;height:36px;object-fit:contain;display:block;">
      </div>
      <!-- Logo 2: VTESA second -->
      <div class="logo-circle">
        <img src="${VTESA_LOGO_B64}" alt="VTESA" style="width:36px;height:36px;object-fit:contain;display:block;">
      </div>
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


// ── Beautiful HTML Email builder ──────────────────────────────────────────────
function buildEmailHTML(fullName, cardLink, data, dob) {
  const BASE = 'https://the-achievers-26-production.up.railway.app';
  const allRows = [
    ['🎓 Full Name',          data.fullName],
    ['✨ Nickname',           data.nickname],
    ['📱 Social Handle',      data.socialHandle],
    ['🎂 Date of Birth',      dob],
    ['🏆 Best Level',         data.bestLevel],
    ['😬 Worst Level',        data.worstLevel],
    ['📚 Best Course',        data.bestCourse],
    ['💀 Worst Course',       data.worstCourse],
    ['👨‍🏫 Fav. Lecturer',    data.favLecturer],
    ['💕 Class Crush',        data.classCrush || '—'],
    ['❤️ Relationship',       data.relStatus],
    ['🔀 If Not VTE',         data.ifNotVte],
    ['⭐ Best Experience',    data.bestExp],
    ['😰 Worst Experience',   data.worstExp],
    ['🗺️ State of Origin',   data.stateOfOrigin],
    ['🎯 Hobbies',            data.hobbies],
  ];

  // Gmail-safe: light backgrounds, dark text. bgcolor on <td> is the only reliable way.
  const tableRows = allRows.map(([k, v], i) => `
    <tr bgcolor="${i % 2 === 0 ? '#f0faf0' : '#ffffff'}">
      <td width="44%" style="padding:10px 14px;border-bottom:1px solid #c8e8c8;">
        <span style="color:#1a6b1a;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">${esc(k)}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #c8e8c8;">
        <span style="color:#111111;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;">${esc(String(v || '—'))}</span>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Finalist Card — ${esc(fullName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;" bgcolor="#f4f4f4">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4">
<tr><td align="center" style="padding:24px 12px 40px;">

  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <!-- GOLD TOP BAR -->
    <tr>
      <td bgcolor="#d4a017" height="5" style="font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- HEADER — dark green, Gmail renders bgcolor reliably here -->
    <tr>
      <td bgcolor="#1a5c1a" style="padding:26px 28px 22px;">

        <!-- Logos row -->
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <!-- EKSU logo -->
            <td style="padding-right:10px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" width="54" height="54" style="border-radius:50%;border:2px solid #f5c842;text-align:center;vertical-align:middle;">
                    <img src="${BASE}/eksu-logo.png" alt="EKSU" width="44" height="44" style="display:block;border:0;margin:5px;">
                  </td>
                </tr>
              </table>
            </td>
            <!-- VTESA logo -->
            <td style="padding-right:14px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" width="54" height="54" style="border-radius:50%;border:2px solid #f5c842;text-align:center;vertical-align:middle;">
                    <img src="${BASE}/vtesa-logo.png" alt="VTESA" width="44" height="44" style="display:block;border:0;margin:5px;">
                  </td>
                </tr>
              </table>
            </td>
            <!-- Text -->
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:12px;font-weight:bold;color:#ffffff;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;line-height:1.5;">Vocational &amp; Technical Education<br>Students Association</p>
              <p style="margin:4px 0 0;font-size:10px;font-weight:bold;color:#f5c842;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Ekiti State University, Ado Ekiti</p>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 16px;">
          <tr><td bgcolor="#f5c842" height="1" style="font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>

        <!-- Title -->
        <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:36px;color:#ffffff;font-style:italic;">The Achievers 26'</p>
        <!-- CLASS OF 26 badge — dark green matching design colours (was purple #6600cc) -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
          <tr>
            <td bgcolor="#0e4a0e" style="padding:5px 20px;border-radius:20px;border:1px solid #f5c842;">
              <span style="font-size:12px;font-weight:bold;color:#f5c842;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">CLASS OF 26</span>
            </td>
          </tr>
        </table>

        <!-- New card banner — white bg so text is always visible in Gmail -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="#ffffff" style="padding:16px 20px;border-radius:10px;border:2px solid #f5c842;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#1a6b1a;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">🎉 New Finalist Card Submitted</p>
              <p style="margin:0 0 4px;font-size:24px;font-weight:bold;color:#111111;font-family:Arial,sans-serif;">${esc(fullName)}</p>
              <p style="margin:0;font-size:12px;color:#444444;font-family:Arial,sans-serif;">aka <em style="color:#b8860b;font-weight:bold;">${esc(data.nickname)}</em> &nbsp;&bull;&nbsp; ${esc(data.socialHandle)}</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- QUOTE BLOCK — white bg with gold left border accent -->
    <tr>
      <td bgcolor="#ffffff" style="padding:0;border-left:4px solid #f5c842;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="#ffffff" style="padding:18px 20px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#1a6b1a;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">💬 Favourite Quote</p>
              <p style="margin:0;font-size:14px;color:#333333;font-style:italic;line-height:1.7;font-family:Georgia,serif;">"${esc(data.favQuote)}"</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- DETAILS HEADER -->
    <tr>
      <td bgcolor="#1a5c1a" style="padding:10px 18px;">
        <span style="font-size:10px;font-weight:bold;color:#f5c842;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">📋 Finalist Details</span>
      </td>
    </tr>

    <!-- DATA TABLE — light rows, dark text, Gmail-safe -->
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${tableRows}
        </table>
      </td>
    </tr>

    <!-- CTA SECTION — white bg -->
    <tr>
      <td bgcolor="#ffffff" style="padding:28px 32px;text-align:center;border-top:3px solid #1a5c1a;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#1a5c1a;font-family:Arial,sans-serif;">The full finalist card is ready!</p>
        <p style="margin:0 0 20px;font-size:13px;color:#555555;line-height:1.7;font-family:Arial,sans-serif;">View and download the card before the link expires.<br>⏳ This link <strong style="color:#c8900a;">expires in 24 hours</strong> — download it now!</p>
        <table cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td bgcolor="#1a5c1a" style="border-radius:12px;">
              <a href="${cardLink}" style="display:block;padding:16px 42px;text-decoration:none;color:#f5c842;font-size:15px;font-weight:900;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">👁 View &amp; Download Full Card</a>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#888888;font-family:Arial,sans-serif;">⏳ Link expires in 24 hours</p>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td bgcolor="#f0faf0" style="padding:16px 28px 20px;text-align:center;border-top:1px solid #c8e8c8;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
          <tr><td bgcolor="#d4a017" height="3" style="font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0;font-size:11px;color:#666666;line-height:1.7;font-family:Arial,sans-serif;">This card was automatically generated by the Achievers 26' Card System.<br>&copy; ${new Date().getFullYear()} VTESA &mdash; Ekiti State University, Ado Ekiti</p>
      </td>
    </tr>

    <!-- GOLD BOTTOM BAR -->
    <tr>
      <td bgcolor="#d4a017" height="4" style="font-size:0;line-height:0;">&nbsp;</td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`;
}


// ── Send email via SendPulse HTTP API ─────────────────────────────────────────
async function getSendPulseToken() {
  const r = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.SP_CLIENT_ID,
      client_secret: process.env.SP_CLIENT_SECRET,
    }),
  });
  const d = await r.json();
  return d.access_token;
}

async function sendEmail(fullName, cardLink, data) {
  const spToken = await getSendPulseToken();

  const emailText = [
    `New Finalist Card submitted by ${fullName}.`,
    `View & Download: ${cardLink}`,
    `⏳ This link expires in 24 hours.`,
  ].join('\n');

  const r = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${spToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: {
        text: emailText,
        subject: `🎓 New Finalist Card — ${fullName} | Achievers 26'`,
        from: { name: "Achievers 26' Cards", email: process.env.SMTP_USER },
        to: [{ name: 'Admin', email: process.env.ADMIN_EMAIL }],
      }
    }),
  });
  const responseText = await r.text();
  console.log('📧 SendPulse response status:', r.status);
  console.log('📧 SendPulse response body:', responseText);
  if (!r.ok) {
    throw new Error(`SendPulse error ${r.status}: ${responseText}`);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Card view route with countdown, Download as PDF, Download as Image ────────
app.get('/card/:token', (req, res) => {
  const entry = getCard(req.params.token);
  if (!entry) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Expired — Achievers 26'</title>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:linear-gradient(160deg,#0b1a0b,#0a120a);min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;padding:24px;}
  .box{background:linear-gradient(160deg,#1e6b1e,#0e4a0e);border:1px solid rgba(245,200,66,0.3);border-radius:20px;padding:48px 36px;text-align:center;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.7);}
  .title{font-family:'Dancing Script',cursive;font-size:32px;color:#f5c842;margin-bottom:12px;}
  .icon{font-size:52px;margin-bottom:16px;}
  .msg{color:rgba(255,255,255,0.75);font-size:14px;line-height:1.7;}
  .bar{height:3px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017);border-radius:2px;margin:20px 0;}
</style>
</head>
<body>
<div class="box">
  <div class="icon">⏰</div>
  <div class="title">Link Expired</div>
  <div class="bar"></div>
  <div class="msg">This card link has expired or does not exist.<br><br>Please contact the Achievers 26' admin to get your card resent.</div>
</div>
</body>
</html>`);
  }

  const expiresAt = entry.expires;
  const safeName = esc(entry.name);

  // Inject the full action bar (countdown + both download buttons) before </body>
  const actionBar = `

<!-- ── ACTION BAR ── -->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');
  #action-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
    background: linear-gradient(135deg, #0e4a0e, #0a3a0a);
    border-top: 2px solid rgba(245,200,66,0.4);
    padding: 10px 16px 12px;
    font-family: 'Montserrat', sans-serif;
    box-shadow: 0 -6px 30px rgba(0,0,0,0.6);
  }
  #countdown-row {
    text-align: center;
    margin-bottom: 10px;
  }
  #countdown-label {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  #countdown-timer {
    font-size: 20px;
    font-weight: 900;
    color: #f5c842;
    letter-spacing: 0.05em;
    margin-top: 2px;
    transition: color 0.4s;
  }
  #countdown-timer.urgent { color: #ff6b6b; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.6;} }
  #countdown-warning {
    font-size: 11px;
    font-weight: 700;
    color: #ff9999;
    margin-top: 3px;
    display: none;
  }
  #countdown-warning.show { display: block; }
  #btn-row {
    display: flex;
    gap: 10px;
  }
  .dl-btn {
    flex: 1;
    padding: 12px 10px;
    border: none;
    border-radius: 10px;
    font-family: 'Montserrat', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .dl-btn:active { transform: scale(0.97); }
  .dl-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  #btn-image {
    background: linear-gradient(135deg, #2a8a2a, #1a6b1a);
    color: #fff;
    border: 1.5px solid rgba(245,200,66,0.3);
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
  }
  #btn-image:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
  #btn-pdf {
    background: linear-gradient(135deg, #f5c842, #d4a017);
    color: #111;
    box-shadow: 0 4px 14px rgba(212,160,23,0.35);
  }
  #btn-pdf:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212,160,23,0.5); }
  /* Push card up so it's not hidden behind bar */
  body { padding-bottom: 120px !important; }
  @media (max-width: 380px) {
    .dl-btn { font-size: 12px; padding: 11px 6px; }
    #countdown-timer { font-size: 17px; }
  }
  @media print {
    #action-bar { display: none !important; }
    body { padding: 0 !important; margin: 0 !important; background: #111 !important; }
    .card { box-shadow: none !important; margin: 0 auto !important; }
    @page { margin: 0; size: auto; }
  }
</style>

<div id="action-bar">
  <div id="countdown-row">
    <div id="countdown-label">⏳ Link expires in</div>
    <div id="countdown-timer">--:--:--</div>
    <div id="countdown-warning">⚠️ Expiring soon — download your card now!</div>
  </div>
  <div id="btn-row">
    <button class="dl-btn" id="btn-image" onclick="saveImage()">
      🖼 Save as Image
    </button>
    <button class="dl-btn" id="btn-pdf" onclick="savePDF()">
      📄 Save as PDF
    </button>
  </div>
</div>

<script>
// ── COUNTDOWN ─────────────────────────────────────────────────────────────────
(function() {
  var expiresAt = ${expiresAt};
  var timerEl   = document.getElementById('countdown-timer');
  var warnEl    = document.getElementById('countdown-warning');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      timerEl.textContent = '00:00:00';
      timerEl.classList.add('urgent');
      warnEl.classList.add('show');
      warnEl.textContent = '❌ This link has now expired. Please contact the admin.';
      document.getElementById('btn-image').disabled = true;
      document.getElementById('btn-pdf').disabled = true;
      return;
    }
    var h = Math.floor(remaining / 3600000);
    var m = Math.floor((remaining % 3600000) / 60000);
    var s = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    if (remaining < 30 * 60 * 1000) {
      timerEl.classList.add('urgent');
      warnEl.classList.add('show');
    }
    setTimeout(tick, 1000);
  }
  tick();
})();

// ── SAVE AS IMAGE — opens clean card page, user long-presses to save ──────────
function saveImage() {
  window.open('/card-clean/${req.params.token}', '_blank');
}

// ── SAVE AS PDF — triggers browser print dialog (Save as PDF on mobile) ───────
function savePDF() {
  window.print();
}
<\/script>


`;

  const withActions = entry.html.replace('</body>', actionBar + '\n</body>');
  res.send(withActions);
});

// ── Clean card page — just the card, no action bar, for saving as image ───────
app.get('/card-clean/:token', (req, res) => {
  const entry = getCard(req.params.token);
  if (!entry) return res.status(404).send('Expired');
  // Inject a small tip overlay
  const tip = `<style>body{background:#111;}.save-tip{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#f5c842;font-family:Arial,sans-serif;font-size:13px;padding:10px 18px;border-radius:20px;white-space:nowrap;z-index:999;pointer-events:none;}@media print{.save-tip{display:none!important;}body{padding:0!important;}@page{margin:0;size:auto;}}</style><div class="save-tip">📸 Long-press the card → Save Image &nbsp;|&nbsp; Or share → Print to save as PDF</div>`;
  res.send(entry.html.replace('</body>', tip + '\n</body>'));
});


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
    const token = saveCard(cardHTML, data.fullName);
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const cardLink = `${baseUrl}/card/${token}`;
    let emailSent = false;
    try {
      await Promise.race([
        sendEmail(data.fullName, cardLink, data).then(() => { emailSent = true; }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 8000)),
      ]);
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
