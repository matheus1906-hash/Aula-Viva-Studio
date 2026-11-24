(function (AV) {
  "use strict";
  /* Ícones ilustrados da tela inicial: pequenas cenas coloridas, uma para cada opção. */
  const star = (cx, cy, r, fill) => `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}"/>`;
  const bg = (a, b) => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/>`;
  const sh = `<ellipse cx="32" cy="55" rx="17" ry="2.6" fill="#0f172a" opacity=".08"/>`;
  const I = {
    wand: bg("#FFE3F0", "#FBCFE8") + sh +
      `<path d="M15 50 41 24" stroke="#3B2F5E" stroke-width="6.5" stroke-linecap="round"/><path d="M37 28 41 24" stroke="#FFD34E" stroke-width="6.5" stroke-linecap="round"/>` +
      star(46, 15, 7.5, "#EC4899") + star(24, 17, 4.6, "#F59E0B") + star(51, 35, 4.2, "#8B5CF6") + `<circle cx="33" cy="12" r="1.8" fill="#EC4899"/><circle cx="54" cy="24" r="1.6" fill="#F59E0B"/>`,
    chat: bg("#E0F2FE", "#BAE6FD") + sh +
      `<rect x="30" y="15" width="22" height="16" rx="7" fill="#FBBF24"/><path d="M45 30l4 5-1-6z" fill="#FBBF24"/>` +
      `<rect x="11" y="21" width="32" height="23" rx="10" fill="#0EA5E9"/><path d="M17 42l-3 8 9-6z" fill="#0EA5E9"/>` +
      `<circle cx="20" cy="32.5" r="2.6" fill="#fff"/><circle cx="27" cy="32.5" r="2.6" fill="#fff"/><circle cx="34" cy="32.5" r="2.6" fill="#fff"/>`,
    studio: bg("#D9F5EC", "#A7F3D0") + sh +
      `<rect x="22" y="10" width="26" height="33" rx="4" fill="#6EE7B7" transform="rotate(8 35 26)"/>` +
      `<rect x="14" y="14" width="27" height="35" rx="4" fill="#fff"/><rect x="19" y="20" width="17" height="3" rx="1.5" fill="#0B6E5F"/><rect x="19" y="26" width="13" height="2.4" rx="1.2" fill="#94A3B8"/><rect x="19" y="31" width="15" height="2.4" rx="1.2" fill="#94A3B8"/>` +
      `<circle cx="44" cy="43" r="10" fill="#0B6E5F"/><path d="M40 43v0M43 39.5v7M46 41v4M49 42.5v1" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
    puzzle: bg("#FFE4E6", "#FECDD3") + sh +
      `<rect x="13" y="13" width="18" height="18" rx="4" fill="#FB7185"/><rect x="33" y="13" width="18" height="18" rx="4" fill="#FBBF24"/><rect x="13" y="33" width="18" height="18" rx="4" fill="#2DD4BF"/><rect x="33" y="33" width="18" height="18" rx="4" fill="#8B5CF6"/>` +
      `<circle cx="32" cy="22" r="4.2" fill="#FB7185"/><circle cx="22" cy="32" r="4.2" fill="#2DD4BF"/><circle cx="42" cy="32" r="4.2" fill="#FBBF24"/><circle cx="32" cy="42" r="4.2" fill="#8B5CF6"/>`,
    book: bg("#E0E7FF", "#C7D2FE") + sh +
      `<path d="M10 20c7-3 15-3 22 1v29c-7-4-15-4-22-1z" fill="#4F46E5"/><path d="M54 20c-7-3-15-3-22 1v29c7-4 15-4 22-1z" fill="#6366F1"/>` +
      `<path d="M12 18c6-2.5 13-2.3 20 1.5V47c-7-3.6-14-3.8-20-1.4z" fill="#fff"/><path d="M52 18c-6-2.5-13-2.3-20 1.5V47c7-3.6 14-3.8 20-1.4z" fill="#F8FAFC"/>` +
      `<path d="M16 25h11M16 30h11M16 35h8M37 25h11M37 30h11M37 35h9" stroke="#A5B4FC" stroke-width="2" stroke-linecap="round"/><path d="M44 17v14l3-2.5 3 2.5V17.5z" fill="#F43F5E"/>`,
    list: bg("#FFEDD5", "#FED7AA") + sh +
      `<rect x="14" y="12" width="36" height="42" rx="6" fill="#F97316"/><rect x="18" y="17" width="28" height="33" rx="3" fill="#fff"/><rect x="25" y="9" width="14" height="7" rx="3" fill="#7C2D12"/>` +
      `<path d="M22 25l2.5 2.5L29 23M22 34l2.5 2.5L29 32" stroke="#16A34A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="43" r="2.6" fill="none" stroke="#CBD5E1" stroke-width="2"/>` +
      `<path d="M32 25.5h10M32 34.5h10M32 43h8" stroke="#FDBA74" stroke-width="2.4" stroke-linecap="round"/>`,
    exam: bg("#E2E8F0", "#CBD5E1") + sh +
      `<rect x="13" y="10" width="30" height="40" rx="4" fill="#fff"/><path d="M18 18h14M18 24h20M18 30h17M18 36h20" stroke="#CBD5E1" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="38" cy="40" r="9" fill="#EF4444"/><text x="38" y="43.6" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="10" fill="#fff">A+</text>` +
      `<g transform="rotate(40 48 26)"><rect x="45" y="8" width="6.5" height="30" rx="1.5" fill="#FACC15"/><path d="M45 38h6.5l-3.25 6z" fill="#FDE68A"/><path d="M47.2 42h2.1l-1.05 2z" fill="#334155"/><rect x="45" y="8" width="6.5" height="4" rx="1.5" fill="#F472B6"/></g>`,
    route: bg("#DCFCE7", "#BBF7D0") + sh +
      `<rect x="10" y="12" width="24" height="24" rx="4" fill="#fff"/><rect x="13" y="15" width="7" height="7" rx="1" fill="#14532D"/><rect x="24" y="15" width="7" height="7" rx="1" fill="#14532D"/><rect x="13" y="26" width="7" height="7" rx="1" fill="#14532D"/>` +
      `<path d="M25 26h2v2h-2zM28 29h3v3h-3zM24 31h2v2h-2z" fill="#14532D"/>` +
      `<path d="M22 44c6 4 13-2 19 1" stroke="#16A34A" stroke-width="2.4" stroke-dasharray="1 4" stroke-linecap="round" fill="none"/>` +
      `<path d="M45 49s-10-9-10-16a10 10 0 0 1 20 0c0 7-10 16-10 16z" fill="#22C55E"/><circle cx="45" cy="33" r="4" fill="#fff"/>`,
    calendar: bg("#EDE9FE", "#DDD6FE") + sh +
      `<rect x="11" y="15" width="42" height="36" rx="6" fill="#fff"/><path d="M11 21a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v5H11z" fill="#8B5CF6"/>` +
      `<rect x="19" y="10" width="4" height="9" rx="2" fill="#4C1D95"/><rect x="41" y="10" width="4" height="9" rx="2" fill="#4C1D95"/>` +
      `<g fill="#DDD6FE"><rect x="16" y="31" width="6" height="5" rx="1.5"/><rect x="25" y="31" width="6" height="5" rx="1.5"/><rect x="43" y="31" width="6" height="5" rx="1.5"/><rect x="16" y="40" width="6" height="5" rx="1.5"/><rect x="25" y="40" width="6" height="5" rx="1.5"/><rect x="34" y="40" width="6" height="5" rx="1.5"/></g>` +
      `<rect x="33" y="29.5" width="8" height="8" rx="2.5" fill="#F59E0B"/><path d="M35 33.5l1.5 1.5 3-3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    rocket: bg("#CFFAFE", "#A5F3FC") + sh +
      star(15, 16, 3.5, "#fff") + star(50, 47, 3, "#fff") + `<circle cx="51" cy="14" r="1.6" fill="#fff"/>` +
      `<path d="M26 44c-3 2-5 7-5 10 3 0 8-2 10-5z" fill="#FB923C"/><path d="M27 46c-1.5 1.3-2.4 3.6-2.4 5.3 1.7 0 4-.9 5.3-2.4z" fill="#FDE047"/>` +
      `<path d="M24 38l-7 1 6-9 6 1zM34 40l-1 7 9-6-1-6z" fill="#EF4444"/>` +
      `<path d="M47 12c-10 0-19 7-23 22l7 7c15-4 22-13 22-23v-6z" fill="#fff"/><path d="M47 12h6v6c0 2-.3 4-.9 5.8L41.2 12.9C43 12.3 45 12 47 12z" fill="#EF4444"/>` +
      `<circle cx="39" cy="25" r="5" fill="#0891B2"/><circle cx="39" cy="25" r="2.6" fill="#A5F3FC"/>`,
    blank: bg("#F1F5F9", "#E2E8F0") + sh +
      `<path d="M16 10h22l10 10v31a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z" fill="#fff"/><path d="M38 10v8a2 2 0 0 0 2 2h8z" fill="#CBD5E1"/>` +
      `<path d="M19 28h16M19 34h12" stroke="#E2E8F0" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="44" cy="44" r="10" fill="#0B6E5F"/><path d="M44 39v10M39 44h10" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`,
    shelf: bg("#FEF3C7", "#FDE68A") + sh +
      `<rect x="13" y="18" width="7" height="30" rx="1.5" fill="#EF4444"/><rect x="21" y="13" width="8" height="35" rx="1.5" fill="#3B82F6"/><rect x="30" y="20" width="6" height="28" rx="1.5" fill="#10B981"/>` +
      `<rect x="40" y="17" width="7.5" height="31" rx="1.5" fill="#8B5CF6" transform="rotate(14 44 48)"/>` +
      `<path d="M22.5 19h5M22.5 22h5M14.5 23h4" stroke="#fff" stroke-width="1.4" opacity=".8"/>` +
      `<rect x="9" y="48" width="46" height="5" rx="2" fill="#92400E"/>`,
    folder: bg("#FEF3C7", "#FDE68A") + sh +
      `<path d="M10 20a4 4 0 0 1 4-4h11l4 4h21a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#D97706"/>` +
      `<rect x="17" y="17" width="28" height="22" rx="2" fill="#fff" transform="rotate(-6 31 28)"/><path d="M21 24.5l14-1.5M21.5 29l10-1" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M10 28a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#F59E0B"/>`,
    globe: bg("#CCFBF1", "#99F6E4") + sh +
      `<circle cx="27" cy="34" r="17" fill="#0EA5E9"/><path d="M17 24c4 1 6 4 5 7s3 4 3 7-2 5-4 6c-4-3-7-8-7-13 0-3 1-5 3-7zM31 18c2 2 6 2 8 5s-1 5-4 5-4 3-2 6 5 3 6 6c-2 2-4 3-7 4" fill="#22C55E"/>` +
      `<rect x="35" y="10" width="20" height="15" rx="5" fill="#fff"/><path d="M40 24l-2 5 6-4z" fill="#fff"/><text x="45" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="#0F766E">Aa</text>`
  };
  AV.HICONS = I;
  let uid = 0;
  /* ícone ilustrado; se não houver, cai no ícone normal do app */
  AV.homeIcon = function (name, color, cls) {
    if (!I[name]) return AV.appIcon(name, color, cls);
    const id = "hg" + ++uid;
    const sp = document.createElement("span");
    sp.className = "hico" + (cls ? " " + cls : "");
    sp.setAttribute("aria-hidden", "true");
    sp.innerHTML = '<svg viewBox="0 0 64 64" width="56" height="56">' + I[name].replace(/id="g"/g, 'id="' + id + '"').replace(/url\(#g\)/g, "url(#" + id + ")") + "</svg>";
    return sp;
  };
})(globalThis.AV = globalThis.AV || {});
