/* Arte vetorial original para os 12 cartões da home. Sem assets externos. */
(function(AV){
"use strict";
const NS="http://www.w3.org/2000/svg";
const themes={
 ai:["#efe8ff","#7251d2","#ad80ee"],chat:["#e1f2ff","#3179c9","#7ec5f2"],
 video:["#fff0e7","#e66e54","#ffbc83"],activities:["#fff4dc","#c78224","#efbd65"],
 models:["#e5f0ff","#4977ce","#8bb4ee"],book:["#e5f8ef","#238777","#83c8a3"],
 exam:["#fae8f2","#b64c84","#efabc8"],exercises:["#fff1dc","#ce8431","#edc27d"],
 sources:["#efe9fb","#7451aa","#baa2e9"],abnt:["#e8efff","#4269ad","#a2b6e4"],
 study:["#fcecf2","#b56691","#eab6ce"],library:["#e8f6f6","#237c8b","#8dccca"]
};
const shapes={
 ai:[["rect",18,24,46,53,8,"white"],["line",26,41,48,41],["line",26,49,45,49],["line",26,57,43,57],["path","M66 20 L78 8 M73 28 L84 25 M58 15 L55 6"],["path","M52 64 L76 37"],["path","M74 30 L81 37 L75 44 L69 37 Z"]],
 chat:[["rect",11,19,57,37,14,"white"],["path","M28 56 L23 66 L43 55"],["rect",45,43,42,29,13,"accent"],["path","M67 72 L79 79 L75 70"],["circle",25,36,3,"ink"],["circle",39,36,3,"ink"],["circle",52,36,3,"ink"],["path","M65 50 L67 55 L72 57 L67 59 L65 64 L63 59 L58 57 L63 55 Z"]],
 video:[["rect",14,28,70,48,10,"white"],["path","M14 34 L84 34 L84 44 L14 44 Z"],["line",32,34,39,44],["line",52,34,59,44],["circle",46,62,11,"accent"],["path","M42 55 L54 62 L42 69 Z"],["circle",75,17,9,"accent"],["path","M70 17 L79 17"]],
 activities:[["rect",21,15,54,65,8,"white"],["rect",29,25,14,14,3,"accent"],["path","M33 32 L36 35 L41 29"],["line",49,32,66,32],["rect",29,46,14,14,3,"accent"],["path","M32 52 L40 57 M40 52 L32 57"],["line",49,53,66,53],["path","M67 72 L82 55 L88 61 L73 78 Z"]],
 models:[["rect",11,24,48,58,7,"accent"],["rect",22,17,49,60,7,"white"],["rect",35,11,49,60,7,"white"],["rect",43,20,31,19,4,"accent"],["line",43,47,76,47],["line",43,54,70,54],["line",43,61,62,61]],
 book:[["path","M49 27 Q30 17 12 28 L12 75 Q31 66 49 77 Z"],["path","M49 27 Q68 17 86 28 L86 75 Q68 66 49 77 Z"],["line",49,27,49,77],["line",20,38,39,35],["line",20,47,39,44],["line",58,35,77,38],["line",58,44,77,47],["rect",72,17,9,25,2,"accent"]],
 exam:[["rect",22,18,56,63,8,"white"],["rect",36,12,26,11,5,"accent"],["rect",30,34,10,10,2,"accent"],["path","M32 39 L35 42 L40 36"],["line",46,39,68,39],["rect",30,53,10,10,2,"accent"],["path","M32 58 L35 61 L40 55"],["line",46,58,68,58],["path","M72 18 L83 8 L89 15 L79 25 Z"]],
 exercises:[["rect",20,16,60,64,7,"white"],["circle",32,34,6,"accent"],["circle",32,51,6,"accent"],["circle",32,68,6,"accent"],["line",45,34,71,34],["line",45,51,71,51],["line",45,68,65,68],["path","M77 73 L91 55 L95 60 L82 78 Z"]],
 sources:[["path","M12 35 L12 25 Q12 20 17 20 L39 20 L47 28 L78 28 Q84 28 84 35 L84 73 L12 73 Z"],["rect",29,9,42,36,5,"white"],["line",35,19,64,19],["line",35,27,59,27],["path","M47 42 L47 65 M39 58 L47 66 L55 58"],["path","M65 52 L69 58 L75 54"]],
 abnt:[["rect",21,10,58,76,6,"white"],["rect",29,20,42,56,2,"none"],["line",35,33,65,33],["line",35,42,65,42],["line",35,51,65,51],["line",35,60,57,60],["path","M12 15 L12 77 M8 15 L16 15 M8 77 L16 77"],["rect",67,25,10,38,2,"accent"]],
 study:[["path","M13 33 L13 75 L46 81 L46 38 Z"],["path","M46 38 L46 81 L79 75 L79 33 Z"],["line",22,46,38,49],["line",22,55,38,58],["line",54,49,70,46],["line",54,58,70,55],["path","M76 22 L85 10 L91 14 L82 26"],["circle",83,31,6,"accent"]],
 library:[["rect",14,15,72,67,7,"white"],["line",17,61,83,61],["rect",22,25,12,34,2,"accent"],["rect",37,19,12,40,2,"accent"],["rect",52,28,12,31,2,"accent"],["path","M67 25 L80 29 L73 57 L61 53 Z"],["circle",75,70,11,"none"],["path","M83 78 L94 89"]]
};
const vector=(name,meta)=>{
 const palette=themes[name]||themes.ai;
 const svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 100 96");svg.setAttribute("class","home-illustration-svg");
 svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
 const add=(tag,attrs)=>{const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));svg.appendChild(el);return el;};
 add("circle",{cx:75,cy:43,r:39,fill:palette[2],opacity:".2"});
 add("circle",{cx:24,cy:70,r:28,fill:"#fff",opacity:".45"});
 const ink=palette[1];
 for(const s of shapes[name]||shapes.ai){
  const type=s[0],attrs={stroke:ink,"stroke-width":2.8,"stroke-linecap":"round","stroke-linejoin":"round"};
  if(type==="rect"){Object.assign(attrs,{x:s[1],y:s[2],width:s[3],height:s[4],rx:s[5],fill:s[6]==="white"?"#fff":s[6]==="accent"?palette[2]:s[6]==="none"?"none":palette[0]});}
  else if(type==="line")Object.assign(attrs,{x1:s[1],y1:s[2],x2:s[3],y2:s[4],fill:"none"});
  else if(type==="circle")Object.assign(attrs,{cx:s[1],cy:s[2],r:s[3],fill:s[4]==="accent"?palette[2]:s[4]==="ink"?ink:"none"});
  else if(type==="path")Object.assign(attrs,{d:s[1],fill:s[1].includes(" Z")?palette[2]:"none"});
  add(type,attrs);
 }
 return svg;
};
AV.HOME_CARD_ART={
 palette:themes,
 create:vector,
 badges:{ai:"Rápido",chat:"Flexível",video:"Criativo",activities:"Popular",models:"Personalize",book:"Completo",exam:"Avaliações",exercises:"Prática",sources:"Importar",abnt:"Acadêmico",study:"Apoio",library:"Acervo"}
};
})(globalThis.AV=globalThis.AV||{});
