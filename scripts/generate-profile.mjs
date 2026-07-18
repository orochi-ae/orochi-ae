import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const configPath = path.join(root, "profile.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const owner = process.env.PROFILE_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || config.username;
const name = process.env.PROFILE_NAME || config.displayName;

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function pngPixels(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 1, 4) !== "PNG") throw new Error("Hero must be a PNG");
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  const bitDepth = b[24], colorType = b[25], interlace = b[28];
  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error("Expected a non-interlaced 8-bit RGB/RGBA PNG");
  }
  let pos = 8, packed = Buffer.alloc(0);
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString("ascii", pos + 4, pos + 8);
    if (type === "IDAT") packed = Buffer.concat([packed, b.subarray(pos + 8, pos + 8 + len)]);
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(packed);
  const rows = [];
  let previous = Buffer.alloc(stride), offset = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[offset++], left = x >= channels ? row[x - channels] : 0;
      const up = previous[x], upLeft = x >= channels ? previous[x - channels] : 0;
      row[x] = (v + [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upLeft)][filter]) & 255;
    }
    rows.push(row); previous = row;
  }
  return { width, height, channels, rows };
}

function makeAscii() {
  const { width, height, channels, rows } = pngPixels(path.join(root, "assets/hero/orochi.png"));
  const cols = 92, lines = 30, chars = " .,:;irsXA253hMHGS#9B&@";
  const output = [];
  for (let oy = 0; oy < lines; oy++) {
    let line = "";
    for (let ox = 0; ox < cols; ox++) {
      const x = Math.min(width - 1, Math.floor((ox + .5) * width / cols));
      const y = Math.min(height - 1, Math.floor((oy + .5) * height / lines));
      const row = rows[y], i = x * channels;
      const luma = .2126 * row[i] + .7152 * row[i + 1] + .0722 * row[i + 2];
      line += chars[Math.round(luma / 255 * (chars.length - 1))];
    }
    output.push(line);
  }
  const text = output.map((line, i) =>
    `<text x="16" y="${26 + i * 13}" class="${i % 3 === 0 ? "hot" : "ash"}">${esc(line)}</text>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420">
  <rect width="1000" height="420" rx="18" fill="#050505" stroke="#521018"/>
  <style>
    text{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.ash{fill:#9b555a}.hot{fill:#e33442}
    @keyframes ember{50%{fill:#ff6a73;filter:drop-shadow(0 0 4px #f22)}}.hot{animation:ember 3s ease-in-out infinite}
  </style>${text}
  <text x="760" y="398" fill="#ff3344" font-family="monospace" font-size="12">SOURCE: OROCHI // ASCII-92</text>
</svg>`;
}

function terminalSvg() {
  const commands = [
    `booting ${name.toLowerCase().replaceAll(" ", "-")}.profile`,
    "loading: craft / systems / curiosity",
    `identity: ${config.role}`,
    `status: ${config.tagline}`,
    "signal: ONLINE_"
  ];
  const rows = commands.map((line, i) =>
    `<text x="34" y="${78 + i * 31}" class="l l${i}"><tspan class="prompt">❯ </tspan>${esc(line)}</text>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260" viewBox="0 0 1000 260">
  <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="1000" height="260" rx="18" fill="#050505" stroke="#5d1119"/><path d="M0 48h1000" stroke="#351014"/>
  <circle cx="25" cy="24" r="6" fill="#ff3344"/><circle cx="47" cy="24" r="6" fill="#6d1a22"/><circle cx="69" cy="24" r="6" fill="#371015"/>
  <text x="500" y="29" text-anchor="middle" fill="#7d5558" font-family="monospace" font-size="12">OROCHI://TERMINAL</text>
  <style>
    text{font:16px ui-monospace,SFMono-Regular,Consolas,monospace}.l{fill:#ddd;opacity:0;animation:show 8s linear infinite}.prompt{fill:#ff3344;filter:url(#glow)}
    .l0{animation-delay:0s}.l1{animation-delay:1s}.l2{animation-delay:2s}.l3{animation-delay:3s}.l4{animation-delay:4s}
    @keyframes show{0%,8%{opacity:0}10%,90%{opacity:1}100%{opacity:0}}
  </style>${rows}
</svg>`;
}

const divider = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="70" viewBox="0 0 1000 70">
<defs><linearGradient id="g"><stop stop-color="#120306"/><stop offset=".5" stop-color="#ff2337"/><stop offset="1" stop-color="#120306"/></linearGradient></defs>
<style>@keyframes dash{to{stroke-dashoffset:-160}}path{animation:dash 5s linear infinite}</style>
<path d="M20 35h370l35-20 35 40 35-40 35 20h450" fill="none" stroke="url(#g)" stroke-width="2" stroke-dasharray="80 12"/>
<circle cx="495" cy="35" r="5" fill="#ff2337"><animate attributeName="r" values="4;9;4" dur="2s" repeatCount="indefinite"/></circle></svg>`;

fs.mkdirSync(path.join(root, "assets/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "assets/generated/ascii-orochi.svg"), makeAscii());
fs.writeFileSync(path.join(root, "assets/generated/terminal.svg"), terminalSvg());
fs.writeFileSync(path.join(root, "assets/generated/pulse-divider.svg"), divider);

const icons = config.tech.map((item) => `https://skillicons.dev/icons?i=${encodeURIComponent(item)}`).join(",");
const readme = `<div align="center">

<img src="./assets/hero/orochi.png" width="100%" alt="Orochi, an original black and red multi-headed dragon hero banner" />

<img src="./assets/generated/terminal.svg" width="100%" alt="Animated terminal introduction for ${esc(name)}" />

### ${config.role} · ${config.location}

${config.tagline}

[![GitHub](https://img.shields.io/badge/GITHUB-090909?style=for-the-badge&logo=github&logoColor=ff3344)](${config.website})
[![Email](https://img.shields.io/badge/EMAIL-090909?style=for-the-badge&logo=gmail&logoColor=ff3344)](mailto:${config.email})

<br />

  <img src="https://skillicons.dev/icons?i=${config.tech.join(",")}&theme=dark&perline=10" alt="Technology stack: ${config.tech.join(", ")}" />

<br /><br />

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github-readme-stats.vercel.app/api?username=${owner}&show_icons=true&hide_border=true&bg_color=050505&title_color=ff3344&icon_color=ff3344&text_color=bdbdbd&ring_color=ff3344" />
    <img width="49%" alt="GitHub statistics" src="https://github-readme-stats.vercel.app/api?username=${owner}&show_icons=true&hide_border=true&bg_color=050505&title_color=ff3344&icon_color=ff3344&text_color=bdbdbd&ring_color=ff3344" />
  </picture>
  <img width="49%" alt="Most used languages" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${owner}&layout=compact&hide_border=true&bg_color=050505&title_color=ff3344&text_color=bdbdbd" />

<br /><br />

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake.svg" />
    <img alt="Animated contribution graph" src="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake-dark.svg" />
  </picture>

<img src="./assets/generated/pulse-divider.svg" width="100%" alt="" />

\`BUILD · LEARN · SHIP\`

<!-- PROFILE_USERNAME:${owner} -->
</div>
`;
fs.writeFileSync(path.join(root, "README.md"), readme);
console.log(`Generated profile for ${owner}`);
