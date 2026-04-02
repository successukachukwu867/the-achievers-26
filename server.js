const crypto = require('crypto');
require('dotenv').config();
const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Uploads folder ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ── Temp cards store (12hr expiry) ───────────────────────────────────────────
const cardsDir = path.join(__dirname, 'cards');
if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir);
const cardStore = new Map(); // token -> { html, name, expires }

function saveCard(html, name) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  cardStore.set(token, { html, name, expires });
  setTimeout(() => cardStore.delete(token), 12 * 60 * 60 * 1000);
  return token;
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
  .gold-blob-tr { position: absolute; top: -15px; right: -15px; width: 28vw; max-width: 150px; height: 28vw; max-height: 150px; background: radial-gradient(ellipse at 40% 40%, #f9d84a 0%, #d4a017 45%, #8a6000 85%, transparent 100%); border-radius: 50% 20% 60% 30%; opacity: 0.95; z-index: 1; }
  .gold-blob-bl { position: absolute; bottom: -20px; left: -20px; width: 34vw; max-width: 170px; height: 34vw; max-height: 170px; background: radial-gradient(ellipse at 40% 40%, #f9d84a 0%, #d4a017 45%, #8a6000 85%, transparent 100%); border-radius: 40% 60% 30% 70%; opacity: 0.9; z-index: 1; }
  .gold-blob-br { position: absolute; bottom: -10px; right: -10px; width: 22vw; max-width: 110px; height: 18vw; max-height: 90px; background: radial-gradient(ellipse at center, #f9d84a 0%, #d4a017 50%, transparent 100%); border-radius: 60% 30% 50% 40%; opacity: 0.7; z-index: 1; }
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
  .header { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 14px 14px 8px; }
  .logos { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .logo-circle { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 2px solid #f5c842; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  .header-text { flex: 1; min-width: 0; }
  .assoc-name { font-size: clamp(8px, 2.2vw, 11px); font-weight: 800; color: #fff; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.25; }
  .university { font-size: clamp(8px, 2vw, 10px); font-weight: 700; color: #f5c842; letter-spacing: 0.05em; text-transform: uppercase; }
  .divider-dots { border: none; border-top: 2px dashed rgba(245,200,66,0.4); margin: 0 14px 4px; position: relative; z-index: 2; }
  .title-section { position: relative; z-index: 2; text-align: center; padding: 6px 14px 4px; }
  .script-title { font-family: 'Dancing Script', cursive; font-size: clamp(28px, 8vw, 42px); color: #fff; line-height: 1.1; text-shadow: 2px 2px 8px rgba(0,0,0,0.4); }
  .class-badge { display: inline-block; background: #2a8a2a; color: #000; font-size: clamp(10px, 2.8vw, 14px); font-weight: 900; letter-spacing: 0.08em; padding: 3px 20px; border-radius: 4px; margin-top: 3px; text-transform: uppercase; }
  .body { position: relative; z-index: 2; display: flex; gap: 10px; padding: 10px 14px 0; align-items: flex-start; }
  .left-col { width: clamp(180px, 50%, 240px); flex-shrink: 0; display: flex; flex-direction: column; align-items: center; position: relative; border-radius: 10px; overflow: hidden; }
  .left-col::before { content: ''; position: absolute; inset: -10px; z-index: 0; border-left: 2px solid rgba(245,200,66,0.35); border-right: 1px solid rgba(245,200,66,0.15); background: radial-gradient(ellipse 80% 60% at 50% 30%, rgba(245,200,66,0.18) 0%, transparent 65%), radial-gradient(ellipse 60% 80% at 20% 80%, rgba(245,200,66,0.12) 0%, transparent 60%), repeating-linear-gradient(-45deg, transparent 0px, transparent 14px, rgba(255,255,255,0.025) 14px, rgba(255,255,255,0.025) 15px), repeating-linear-gradient(45deg, transparent 0px, transparent 28px, rgba(245,200,66,0.04) 28px, rgba(245,200,66,0.04) 29px); pointer-events: none; }
  .left-col::after { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle 1px at center, rgba(245,200,66,0.35) 0%, transparent 100%); background-size: 18px 18px; pointer-events: none; opacity: 0.5; }
  .left-col > * { position: relative; z-index: 1; }
  .meet-badge { align-self: flex-start; margin-bottom: 6px; line-height: 1; }
  .meet-line { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 6vw, 34px); color: #fff; line-height: 0.92; display: block; font-style: italic; text-shadow: 3px 3px 0px rgba(0,0,0,0.4), -1px -1px 0 rgba(0,0,0,0.2); letter-spacing: 0.02em; }
  .the-finalist-row { display: flex; align-items: center; gap: 3px; line-height: 1; }
  .the-pill { display: inline-flex; align-items: center; justify-content: center; background: #f5c842; color: #111; font-size: clamp(7px, 1.8vw, 10px); font-weight: 900; padding: 2px 5px; border-radius: 3px; text-transform: lowercase; font-family: 'Montserrat', sans-serif; margin-bottom: 1px; }
  .finalist-line { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 6vw, 34px); color: #fff; line-height: 0.92; display: block; font-style: italic; text-shadow: 3px 3px 0px rgba(0,0,0,0.4), -1px -1px 0 rgba(0,0,0,0.2); letter-spacing: 0.02em; }
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
  </div>
  <div class="header">
    <div class="logos">
      <!-- Logo 1: VTESA crest -->
      <div class="logo-circle">
        <svg width="30" height="30" viewBox="0 0 60 60" fill="none">
          <!-- Shield shape -->
          <path d="M30 4 L52 14 L52 36 Q52 50 30 58 Q8 50 8 36 L8 14 Z" fill="#1a6b1a" stroke="#f5c842" stroke-width="2"/>
          <!-- VTE letters -->
          <text x="30" y="28" text-anchor="middle" font-family="Arial" font-weight="900" font-size="11" fill="#f5c842" letter-spacing="-0.5">VTE</text>
          <!-- Star top -->
          <path d="M30 8 L31.2 11.6 L35 11.6 L32 13.8 L33.2 17.4 L30 15.2 L26.8 17.4 L28 13.8 L25 11.6 L28.8 11.6 Z" fill="#f9d84a"/>
          <!-- Torch bottom -->
          <rect x="27.5" y="34" width="5" height="10" rx="1" fill="#f5c842"/>
          <ellipse cx="30" cy="33" rx="4" ry="5" fill="#f9d84a"/>
          <ellipse cx="30" cy="31" rx="2.5" ry="3.5" fill="#fff" opacity="0.6"/>
          <!-- Laurel hints -->
          <path d="M12 38 Q14 33 18 35 Q16 40 12 38Z" fill="#f5c842" opacity="0.7"/>
          <path d="M48 38 Q46 33 42 35 Q44 40 48 38Z" fill="#f5c842" opacity="0.7"/>
        </svg>
      </div>
      <!-- Logo 2: EKSU crest -->
      <div class="logo-circle">
        <svg width="30" height="30" viewBox="0 0 60 60" fill="none">
          <!-- Circular outer ring -->
          <circle cx="30" cy="30" r="26" stroke="#f5c842" stroke-width="2" fill="#0e4a0e"/>
          <!-- Book open -->
          <path d="M14 32 Q30 27 30 27 Q30 27 46 32 L46 44 Q30 39 30 39 Q30 39 14 44 Z" fill="#f5c842" opacity="0.85"/>
          <line x1="30" y1="27" x2="30" y2="39" stroke="#0e4a0e" stroke-width="1.5"/>
          <!-- Flame/torch above book -->
          <ellipse cx="30" cy="22" rx="3.5" ry="5" fill="#f9d84a"/>
          <ellipse cx="30" cy="20" rx="2" ry="3.5" fill="#fff" opacity="0.5"/>
          <!-- Stars on sides -->
          <path d="M18 20 L18.7 22.2 L21 22.2 L19.2 23.5 L19.9 25.7 L18 24.4 L16.1 25.7 L16.8 23.5 L15 22.2 L17.3 22.2 Z" fill="#f5c842"/>
          <path d="M42 20 L42.7 22.2 L45 22.2 L43.2 23.5 L43.9 25.7 L42 24.4 L40.1 25.7 L40.8 23.5 L39 22.2 L41.3 22.2 Z" fill="#f5c842"/>
          <!-- EKSU text -->
          <text x="30" y="52" text-anchor="middle" font-family="Arial" font-weight="900" font-size="7" fill="#f5c842" letter-spacing="0.5">EKSU</text>
        </svg>
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
  const rows = [
    ['🎓 Full Name', data.fullName],
    ['✨ Nickname', data.nickname],
    ['📱 Social Handle', data.socialHandle],
    ['🎂 Date of Birth', dob],
    ['🏆 Best Level', data.bestLevel],
    ['😬 Worst Level', data.worstLevel],
    ['📚 Best Course', data.bestCourse],
    ['💀 Worst Course', data.worstCourse],
    ['👨‍🏫 Favourite Lecturer', data.favLecturer],
    ['💕 Class Crush', data.classCrush || '—'],
    ['❤️ Relationship Status', data.relStatus],
    ['💬 If Not VTE', data.ifNotVte],
    ['⭐ Best Experience', data.bestExp],
    ['😰 Worst Experience', data.worstExp],
    ['🗺️ State of Origin', data.stateOfOrigin],
    ['🎯 Hobbies', data.hobbies],
  ];

  const tableRows = rows.map(([k, v], i) => `
    <tr>
      <td style="padding:10px 18px 10px 20px;border-bottom:1px solid rgba(245,200,66,0.15);background:${i % 2 === 0 ? 'rgba(30,107,30,0.18)' : 'rgba(14,74,14,0.12)'};width:44%;vertical-align:top;">
        <span style="color:#b8e0b8;font-size:11.5px;font-weight:700;letter-spacing:0.04em;font-family:Arial,sans-serif;">${esc(k)}</span>
      </td>
      <td style="padding:10px 20px 10px 16px;border-bottom:1px solid rgba(245,200,66,0.15);background:${i % 2 === 0 ? 'rgba(30,107,30,0.10)' : 'rgba(14,74,14,0.06)'};vertical-align:top;">
        <span style="color:#ffffff;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">${esc(String(v || '—'))}</span>
      </td>
    </tr>`).join('');

  // SVG logos inlined as data URIs - VTESA crest and EKSU crest
  const vtesaLogoSVG = `<svg width="44" height="44" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 4 L52 14 L52 36 Q52 50 30 58 Q8 50 8 36 L8 14 Z" fill="#1a6b1a" stroke="#f5c842" stroke-width="2"/><text x="30" y="29" text-anchor="middle" font-family="Arial" font-weight="900" font-size="10" fill="#f5c842">VTE</text><path d="M30 8 L31.2 11.6 L35 11.6 L32 13.8 L33.2 17.4 L30 15.2 L26.8 17.4 L28 13.8 L25 11.6 L28.8 11.6 Z" fill="#f9d84a"/><rect x="27.5" y="34" width="5" height="10" rx="1" fill="#f5c842"/><ellipse cx="30" cy="33" rx="4" ry="5" fill="#f9d84a"/><ellipse cx="30" cy="31" rx="2.5" ry="3.5" fill="#fff" opacity="0.6"/><path d="M12 38 Q14 33 18 35 Q16 40 12 38Z" fill="#f5c842" opacity="0.7"/><path d="M48 38 Q46 33 42 35 Q44 40 48 38Z" fill="#f5c842" opacity="0.7"/></svg>`;
  const eksuLogoSVG = `<svg width="44" height="44" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="26" stroke="#f5c842" stroke-width="2" fill="#0e4a0e"/><path d="M14 32 Q30 27 30 27 Q30 27 46 32 L46 44 Q30 39 30 39 Q30 39 14 44 Z" fill="#f5c842" opacity="0.85"/><line x1="30" y1="27" x2="30" y2="39" stroke="#0e4a0e" stroke-width="1.5"/><ellipse cx="30" cy="22" rx="3.5" ry="5" fill="#f9d84a"/><ellipse cx="30" cy="20" rx="2" ry="3.5" fill="#fff" opacity="0.5"/><path d="M18 20 L18.7 22.2 L21 22.2 L19.2 23.5 L19.9 25.7 L18 24.4 L16.1 25.7 L16.8 23.5 L15 22.2 L17.3 22.2 Z" fill="#f5c842"/><path d="M42 20 L42.7 22.2 L45 22.2 L43.2 23.5 L43.9 25.7 L42 24.4 L40.1 25.7 L40.8 23.5 L39 22.2 L41.3 22.2 Z" fill="#f5c842"/><text x="30" y="53" text-anchor="middle" font-family="Arial" font-weight="900" font-size="7" fill="#f5c842" letter-spacing="0.5">EKSU</text></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Finalist Card — ${esc(fullName)}</title>
</head>
<body style="margin:0;padding:0;background:#071407;font-family:Arial,'Helvetica Neue',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#071407 0%,#0a1c0a 100%);min-height:100vh;">
<tr><td align="center" style="padding:28px 12px 40px;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

    <!-- ══ TOP GOLD BAR ══ -->
    <tr>
      <td style="background:linear-gradient(90deg,#8a6000,#d4a017,#f9d84a,#f5c842,#f9d84a,#d4a017,#8a6000);height:5px;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- ══ HEADER ══ -->
    <tr>
      <td style="background:linear-gradient(145deg,#1e6b1e 0%,#0e4a0e 45%,#0a3a0a 75%,#1a5c1a 100%);padding:30px 32px 24px;border-left:1px solid rgba(245,200,66,0.25);border-right:1px solid rgba(245,200,66,0.25);">

        <!-- Logos + Association Name -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle;width:56px;">
              <!-- VTESA Logo circle -->
              <div style="width:52px;height:52px;border-radius:50%;background:#ffffff;border:2.5px solid #f5c842;display:inline-block;text-align:center;vertical-align:middle;box-shadow:0 3px 12px rgba(0,0,0,0.5);">
                ${vtesaLogoSVG}
              </div>
            </td>
            <td style="vertical-align:middle;width:14px;">&nbsp;</td>
            <td style="vertical-align:middle;width:56px;">
              <!-- EKSU Logo circle -->
              <div style="width:52px;height:52px;border-radius:50%;background:#ffffff;border:2.5px solid #f5c842;display:inline-block;text-align:center;vertical-align:middle;box-shadow:0 3px 12px rgba(0,0,0,0.5);">
                ${eksuLogoSVG}
              </div>
            </td>
            <td style="vertical-align:middle;padding-left:16px;">
              <div style="font-size:12px;font-weight:800;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;line-height:1.4;font-family:Arial,sans-serif;">Vocational &amp; Technical Education<br>Students Association</div>
              <div style="font-size:10.5px;font-weight:700;color:#f5c842;letter-spacing:0.05em;text-transform:uppercase;margin-top:4px;font-family:Arial,sans-serif;">Ekiti State University, Ado Ekiti</div>
            </td>
          </tr>
        </table>

        <!-- Dashed gold divider -->
        <div style="border:none;border-top:2px dashed rgba(245,200,66,0.4);margin:20px 0 18px;"></div>

        <!-- Title: The Achievers 26' -->
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;color:#ffffff;line-height:1;margin-bottom:6px;font-style:italic;text-shadow:2px 2px 10px rgba(0,0,0,0.6);">The Achievers 26'</div>
        <div style="display:inline-block;background:#2a8a2a;color:#000000;font-size:12px;font-weight:900;letter-spacing:0.1em;padding:4px 20px;border-radius:5px;text-transform:uppercase;margin-bottom:22px;font-family:Arial,sans-serif;">CLASS OF 26</div>

        <!-- Announcement card -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background:linear-gradient(135deg,rgba(245,200,66,0.14) 0%,rgba(245,200,66,0.06) 100%);border:1.5px solid rgba(245,200,66,0.45);border-radius:12px;padding:16px 20px;">
              <div style="font-size:10px;color:#f5c842;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;font-family:Arial,sans-serif;">🎉 New Finalist Card Submitted</div>
              <div style="font-size:24px;color:#ffffff;font-weight:900;letter-spacing:0.03em;font-family:Arial,sans-serif;">${esc(fullName)}</div>
              <div style="font-size:12px;color:rgba(200,240,200,0.7);margin-top:4px;font-family:Arial,sans-serif;">aka <em style="color:#f9d84a;">${esc(data.nickname)}</em> &nbsp;·&nbsp; ${esc(data.socialHandle)}</div>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- ══ FAVOURITE QUOTE HIGHLIGHT ══ -->
    <tr>
      <td style="background:linear-gradient(135deg,#0f2a0f,#0c220c);border-left:1px solid rgba(245,200,66,0.2);border-right:1px solid rgba(245,200,66,0.2);padding:20px 28px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="border-left:4px solid #f5c842;border-radius:0 8px 8px 0;background:linear-gradient(135deg,rgba(245,200,66,0.1),rgba(245,200,66,0.03));padding:14px 18px;">
              <div style="font-size:10px;color:#f5c842;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">💬 Favourite Quote</div>
              <div style="font-size:14px;color:#ffffff;font-style:italic;line-height:1.7;font-family:Georgia,serif;">"${esc(data.favQuote)}"</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══ DATA TABLE ══ -->
    <tr>
      <td style="background:#0c200c;border-left:1px solid rgba(245,200,66,0.2);border-right:1px solid rgba(245,200,66,0.2);padding:0;">
        <!-- Section header -->
        <div style="background:linear-gradient(90deg,rgba(245,200,66,0.18),rgba(245,200,66,0.05));border-bottom:1px solid rgba(245,200,66,0.25);padding:10px 20px;">
          <span style="font-size:10px;color:#f5c842;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;font-family:Arial,sans-serif;">📋 Finalist Details</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          ${tableRows}
        </table>
      </td>
    </tr>

    <!-- ══ CTA BUTTON ══ -->
    <tr>
      <td style="background:linear-gradient(145deg,#0e4a0e,#0a3a0a);border-left:1px solid rgba(245,200,66,0.2);border-right:1px solid rgba(245,200,66,0.2);padding:28px 32px;text-align:center;">
        <div style="font-size:13px;color:rgba(200,235,200,0.75);margin-bottom:20px;line-height:1.7;font-family:Arial,sans-serif;">The full finalist card is ready to view and download.<br>⏳ This link <strong style="color:#f5c842;">expires in 12 hours</strong> — download it now!</div>
        <!-- Big gold CTA button -->
        <table cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td style="background:linear-gradient(135deg,#f9d84a,#f5c842,#d4a017);border-radius:12px;box-shadow:0 6px 24px rgba(212,160,23,0.5);">
              <a href="${cardLink}" style="display:block;padding:16px 42px;text-decoration:none;color:#111111;font-size:16px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;font-family:Arial,sans-serif;">👁 View &amp; Download Full Card</a>
            </td>
          </tr>
        </table>
        <!-- Expiry pill -->
        <div style="margin-top:16px;">
          <span style="display:inline-block;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.3);border-radius:20px;padding:7px 18px;font-size:11px;color:#f5c842;font-weight:800;letter-spacing:0.06em;font-family:Arial,sans-serif;">⏳ Link expires in 12 hours</span>
        </div>
      </td>
    </tr>

    <!-- ══ FOOTER ══ -->
    <tr>
      <td style="background:#071407;border:1px solid rgba(245,200,66,0.12);border-top:none;border-radius:0 0 12px 12px;padding:18px 32px 22px;text-align:center;">
        <!-- Gold bottom bar -->
        <div style="height:3px;background:linear-gradient(90deg,#8a6000,#d4a017,#f9d84a,#d4a017,#8a6000);border-radius:2px;margin-bottom:14px;"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3);line-height:1.7;font-family:Arial,sans-serif;">This card was automatically generated by the Achievers 26' Card System.<br>© ${new Date().getFullYear()} VTESA — Ekiti State University, Ado Ekiti</div>
      </td>
    </tr>

    <!-- ══ BOTTOM GOLD BAR ══ -->
    <tr>
      <td style="background:linear-gradient(90deg,#8a6000,#d4a017,#f9d84a,#f5c842,#f9d84a,#d4a017,#8a6000);height:4px;border-radius:0 0 8px 8px;font-size:0;line-height:0;">&nbsp;</td>
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
  const dob = `${ordinal(parseInt(data.dobDay))} of ${MONTHS[parseInt(data.dobMonth) - 1]}`;
  const emailHTML = buildEmailHTML(fullName, cardLink, data, dob);

  const r = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${spToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: {
        html: emailHTML,
        text: `New Finalist Card submitted by ${fullName}.\n\nView & Download: ${cardLink}\n\n⏳ This link expires in 12 hours.\n\nDetails:\n${Object.entries({ Nickname: data.nickname, 'Social Handle': data.socialHandle, DOB: dob, 'State of Origin': data.stateOfOrigin, Hobbies: data.hobbies }).map(([k,v]) => `${k}: ${v}`).join('\n')}`,
        subject: `🎓 New Finalist Card — ${fullName} | Achievers 26'`,
        from: { name: "Achievers 26' Cards", email: process.env.SMTP_USER },
        to: [{ name: 'Admin', email: process.env.ADMIN_EMAIL }],
      }
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`SendPulse error: ${err}`);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Card view route with countdown, Download as PDF, Download as Image ────────
app.get('/card/:token', (req, res) => {
  const entry = cardStore.get(req.params.token);
  if (!entry || Date.now() > entry.expires) {
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
<!-- ── html2canvas + jsPDF for downloads ── -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>

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
    body { padding-bottom: 0 !important; }
  }
</style>

<div id="action-bar">
  <div id="countdown-row">
    <div id="countdown-label">⏳ Link expires in</div>
    <div id="countdown-timer">--:--:--</div>
    <div id="countdown-warning">⚠️ Expiring soon — download your card now!</div>
  </div>
  <div id="btn-row">
    <button class="dl-btn" id="btn-image" onclick="downloadImage()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      Download as Image
    </button>
    <button class="dl-btn" id="btn-pdf" onclick="downloadPDF()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
      Download as PDF
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

    // Warn when under 30 minutes
    if (remaining < 30 * 60 * 1000) {
      timerEl.classList.add('urgent');
      warnEl.classList.add('show');
    }
    setTimeout(tick, 1000);
  }
  tick();
})();

// ── DOWNLOAD AS IMAGE ─────────────────────────────────────────────────────────
function downloadImage() {
  var btn = document.getElementById('btn-image');
  btn.disabled = true;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Generating...';

  var card = document.getElementById('the-card');
  html2canvas(card, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#111111',
    logging: false,
    windowWidth: card.scrollWidth,
    windowHeight: card.scrollHeight
  }).then(function(canvas) {
    var link = document.createElement('a');
    link.download = 'achievers26-${safeName.replace(/\s+/g, '-').toLowerCase()}.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Download as Image';
  }).catch(function(err) {
    console.error('Image capture failed:', err);
    alert('Image download failed. Please try the PDF option instead.');
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Download as Image';
  });
}

// ── DOWNLOAD AS PDF ───────────────────────────────────────────────────────────
function downloadPDF() {
  var btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Generating PDF...';

  var card = document.getElementById('the-card');
  html2canvas(card, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#111111',
    logging: false,
    windowWidth: card.scrollWidth,
    windowHeight: card.scrollHeight
  }).then(function(canvas) {
    var imgData = canvas.toDataURL('image/png');
    var { jsPDF } = window.jspdf;
    var cardW = card.offsetWidth;
    var cardH = card.offsetHeight;
    // Portrait PDF sized to card aspect ratio
    var pdfW = 210; // A4 width mm
    var pdfH = Math.round((cardH / cardW) * pdfW);
    var pdf = new jsPDF({ orientation: pdfH > pdfW ? 'portrait' : 'landscape', unit: 'mm', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    pdf.save('achievers26-${safeName.replace(/\s+/g, '-').toLowerCase()}.pdf');
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg> Download as PDF';
  }).catch(function(err) {
    console.error('PDF generation failed:', err);
    alert('PDF download failed. Please try the Image option instead.');
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg> Download as PDF';
  });
}
<\/script>


`;

  const withActions = entry.html.replace('</body>', actionBar + '\n</body>');
  res.send(withActions);
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
