/* Ilustrações editoriais coloridas e originais: 12 cenas, sem imagens externas. */
(function(AV){
"use strict";
const NS="http://www.w3.org/2000/svg";
const themes={
 ai:["#eee8ff","#7251d2","#ad80ee"],chat:["#e1f2ff","#3179c9","#7ec5f2"],
 video:["#fff0e7","#e66e54","#ffbc83"],activities:["#fff4dc","#c78224","#efbd65"],
 models:["#e5f0ff","#4977ce","#8bb4ee"],book:["#e5f8ef","#238777","#83c8a3"],
 exam:["#fae8f2","#b64c84","#efabc8"],exercises:["#fff1dc","#ce8431","#edc27d"],
 sources:["#efe9fb","#7451aa","#baa2e9"],abnt:["#e8efff","#4269ad","#a2b6e4"],
 study:["#fcecf2","#b56691","#eab6ce"],library:["#e8f6f6","#237c8b","#8dccca"]
};
const badges={ai:"Rápido",chat:"Flexível",video:"Criativo",activities:"Prática",models:"Personalize",book:"Completo",exam:"Avaliações",exercises:"Exercícios",sources:"Importar",abnt:"Acadêmico",study:"Apoio",library:"Acervo"};
const create=(name)=>{
 if(typeof document==="undefined")return AV.h("span",{class:"home-art-test-fallback","data-art":name});
 const palette=themes[name]||themes.ai, [bg,ink,light]=palette;
 const svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 144 112");svg.setAttribute("class","home-illustration-svg");
 svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
 svg.setAttribute("data-illustration-style","full-color");
 const el=(type,attrs={},parent=svg)=>{const e=document.createElementNS(NS,type);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));parent.appendChild(e);return e;};
 const rect=(x,y,w,h,fill,rx=5,stroke="none",sw=0)=>el("rect",{x,y,width:w,height:h,rx,fill,stroke,"stroke-width":sw});
 const circle=(cx,cy,r,fill,stroke="none",sw=0)=>el("circle",{cx,cy,r,fill,stroke,"stroke-width":sw});
 const ellipse=(cx,cy,rx,ry,fill)=>el("ellipse",{cx,cy,rx,ry,fill});
 const path=(d,fill,stroke="none",sw=0)=>el("path",{d,fill,stroke,"stroke-width":sw,"stroke-linecap":"round","stroke-linejoin":"round"});
 const line=(x1,y1,x2,y2,stroke=ink,sw=3)=>el("line",{x1,y1,x2,y2,stroke,"stroke-width":sw,"stroke-linecap":"round"});
 const spark=(x,y,r=8,c="#FBBF24")=>path(`M${x} ${y-r} Q${x+2} ${y-2} ${x+r} ${y} Q${x+2} ${y+2} ${x} ${y+r} Q${x-2} ${y+2} ${x-r} ${y} Q${x-2} ${y-2} ${x} ${y-r}Z`,c);
 const paper=(x,y,w,h,c="#fff")=>{rect(x+2,y+4,w,h,"#253858",6);rect(x,y,w,h,c,6);rect(x+8,y+8,w-16,7,light,2);};
 const shadow=()=>ellipse(73,99,53,7,"#25385819");
 const rule=(x,y,w,c="#B2BCD6")=>rect(x,y,w,3,c,1.5);
 const pencil=(x,y,angle=0,color="#F9B54B")=>{
  const group=el("g",{transform:`translate(${x} ${y}) rotate(${angle})`});
  el("rect",{x:0,y:0,width:11,height:49,rx:3,fill:color},group);
  el("rect",{x:2,y:5,width:3,height:32,rx:1,fill:"#FFFFFF88"},group);
  el("path",{d:"M0 48 L5.5 59 L11 48 Z",fill:"#F5CAA6"},group);
  el("path",{d:"M3 54 L5.5 59 L8 54 Z",fill:"#3C4053"},group);
  el("rect",{x:0,y:-5,width:11,height:8,rx:3,fill:"#F88F96"},group);
 };
 // Scene-specific objects are opaque, layered and multicolored (no outlined placeholders).
 shadow();
 switch(name){
 case "ai":
  rect(19,25,77,61,"#6042B9",13);rect(24,20,77,61,"#FFFFFF",11);
  rect(34,31,36,7,"#C4B5FD",3);rule(34,45,48,"#CBC6E8");rule(34,55,40,"#DCD6F2");
  rect(34,66,25,6,"#DDD6FE",3);
  path("M92 78 L116 51 L123 58 L99 85 Z","#F4B63E");path("M114 47 L127 60 L130 57 L117 44Z","#A855F7");
  spark(113,25,12,"#FFBF46");spark(130,38,6,"#FF8E9D");spark(78,10,7,"#7ADCC4");break;
 case "chat":
  rect(16,17,78,52,"#3179C9",18);path("M34 61 L28 79 L54 66Z","#3179C9");
  rect(23,22,68,39,"#E5F3FF",14);
  circle(42,42,5,"#3179C9");circle(57,42,5,"#3179C9");circle(72,42,5,"#3179C9");
  rect(59,54,69,35,"#6545BF",15);path("M106 83 L122 96 L117 80Z","#6545BF");
  rect(67,60,53,22,"#E8E0FF",9);rect(76,69,35,4,"#8065C9",2);
  spark(120,19,10,"#FFBD4E");circle(19,77,5,"#FF8CA9");break;
 case "video":
  rect(13,24,117,70,"#42314F",13);rect(18,29,107,59,"#FFFAF3",9);
  rect(19,29,106,13,"#F46B64",7);
  for(let i=0;i<4;i++)path(`M${25+i*28} 29 L${39+i*28} 42 L${48+i*28} 42 L${34+i*28} 29Z`,"#FFFFFFA8");
  circle(51,65,18,"#FFCD9C");path("M32 62 Q32 43 49 44 Q69 43 70 60 L62 54 L42 55Z","#5C4C8F");
  circle(46,64,2.6,"#393247");circle(58,64,2.6,"#393247");
  path("M47 71 Q52 76 57 71","none","#A85758",2);
  path("M88 55 L88 81 L111 68Z","#FF985A");spark(126,15,8,"#F7B34B");break;
 case "activities":
  paper(25,14,76,82);rect(39,29,18,18,"#FFD883",4);path("M43 38 L48 43 L55 33","none","#2A8F80",4);
  rule(66,35,25,"#8EB6D6");rect(39,54,18,18,"#B8E8D6",4);
  path("M43 63 L48 68 L55 58","none","#268E7C",4);rule(66,61,23,"#B5B7D6");
  pencil(104,30,28,"#FFA35E");circle(21,18,7,"#F59E6E");break;
 case "models":
  rect(15,36,61,55,"#5879CF",8);rect(25,26,66,58,"#97C8F5",8);rect(38,16,73,65,"#FFFFFF",9);
  rect(46,24,57,25,"#F6B78F",5);circle(87,36,9,"#FFE3B0");
  path("M46 48 L64 34 L77 48 L90 39 L103 49Z","#5CA6A3");
  rule(47,57,46,"#AEB8D3");rule(47,65,34,"#D2D9E8");
  rect(91,68,24,16,"#6F77CC",5);spark(119,18,7,"#F5BF50");break;
 case "book":
  path("M19 30 Q42 19 70 31 L70 91 Q42 79 19 91Z","#F8FBFF");
  path("M70 31 Q99 19 122 30 L122 91 Q99 79 70 91Z","#D9FFF0");
  path("M19 30 Q42 19 70 31 L70 91 Q42 79 19 91Z","none","#388A83",2);
  path("M70 31 Q99 19 122 30 L122 91 Q99 79 70 91Z","none","#388A83",2);
  line(70,31,70,92,"#2D7A78",3);
  rule(32,43,26,"#9BBBC7");rule(32,52,30,"#A8CCD5");rule(32,61,25,"#BCD7DF");
  rect(83,42,25,21,"#8CD4B5",5);circle(94,48,5,"#F3E7A0");
  rect(100,19,11,33,"#EAA96B",2);path("M100 51 L105.5 61 L111 51Z","#F6D4B5");
  spark(22,15,8,"#F8C85C");break;
 case "exam":
  rect(27,19,87,77,"#BA6391",11);rect(32,15,77,76,"#FFFFFF",9);
  rect(50,9,41,16,"#8E5AB2",7);rect(58,13,25,5,"#EBD6FF",2);
  for(let i=0;i<3;i++){rect(43,34+i*17,13,13,i===2?"#FFDC8A":"#C5EADB",4);path(`M46 ${40+i*17} L49 ${43+i*17} L54 ${37+i*17}`,"none","#1D9C80",2.8);rule(64,39+i*17,33,"#C1B8D4");}
  circle(118,72,16,"#F6C261");path("M110 73 L116 79 L126 66","none","#FFFFFF",4);break;
 case "exercises":
  paper(25,13,78,83);rect(38,26,19,14,"#FFE3A4",5);rect(38,46,19,14,"#FFE3A4",5);rect(38,66,19,14,"#FFE3A4",5);
  el("text",{x:47.5,y:37,"font-size":11,"text-anchor":"middle","font-weight":"800",fill:"#8F5B24"}).textContent="1";
  el("text",{x:47.5,y:57,"font-size":11,"text-anchor":"middle","font-weight":"800",fill:"#8F5B24"}).textContent="2";
  el("text",{x:47.5,y:77,"font-size":11,"text-anchor":"middle","font-weight":"800",fill:"#8F5B24"}).textContent="3";
  rule(64,32,28,"#9CBAD0");rule(64,52,27,"#9CBAD0");rule(64,72,23,"#9CBAD0");
  pencil(112,40,23,"#F6A650");spark(20,14,7,"#A3CEED");break;
 case "sources":
  rect(19,31,104,59,"#7555BD",10);rect(30,18,63,48,"#FFFFFF",6);
  rect(39,28,42,6,"#A9BCE8",3);rule(39,42,40,"#CFD4EB");rule(39,51,30,"#D9D7E9");
  path("M19 42 Q19 36 28 36 L63 36 L72 46 L123 46 L118 94 L24 94Z","#B79DE4");
  rect(78,55,34,27,"#F4ECFF",6);path("M95 58 L95 77 M89 71 L95 78 L101 71","none","#7251D2",4);
  spark(122,18,9,"#F6BD55");break;
 case "abnt":
  paper(27,13,82,85);rect(40,23,56,62,"#F3F7FF",2);
  rect(47,31,42,4,"#89A6D8",2);rule(47,42,42,"#BAC5DC");rule(47,50,37,"#BAC5DC");rule(47,58,42,"#BAC5DC");rule(47,66,30,"#BAC5DC");
  rect(40,23,2,62,"#F4AB71",0);rect(104,23,2,62,"#F4AB71",0);
  rect(12,32,11,46,"#89B1E3",3);for(let i=0;i<5;i++)line(14,38+i*8,19,38+i*8,"#F6FBFF",1.5);
  circle(112,81,14,"#F2BB68");path("M106 81 L110 85 L118 76","none","#FFFFFF",3);break;
 case "study":
  rect(20,83,106,9,"#BA7D5F",4);rect(29,92,9,11,"#AC7765",2);rect(110,92,9,11,"#AC7765",2);
  path("M27 43 Q48 35 72 45 L72 83 Q48 74 27 82Z","#F6FBFF");
  path("M72 45 Q96 35 116 43 L116 82 Q96 74 72 83Z","#FFE2EE");
  line(72,46,72,83,"#9B79AA",2);rule(35,53,29,"#B9C4DC");rule(35,62,28,"#C8D1E0");
  rule(80,53,26,"#DC9EBD");rule(80,62,24,"#DC9EBD");
  rect(97,17,7,29,"#F1B75A",3);circle(100,16,12,"#F0CFA7");
  path("M95 17 L86 45 L113 45 L105 17Z","#7D82D3");circle(100,14,4,"#FFF7CC");
  spark(25,21,7,"#E3A0C8");break;
 case "library":
  rect(16,18,110,73,"#4E8C97",9);rect(21,23,100,63,"#E7F6F5",5);
  rect(25,67,92,5,"#528C91",2);rect(25,43,92,5,"#528C91",2);
  rect(30,28,13,14,"#F1B864",2);rect(45,25,12,17,"#C17CC0",2);rect(59,29,16,13,"#72BDD0",2);
  rect(79,22,13,20,"#F08B87",2);rect(94,27,16,15,"#7FBF9D",2);
  rect(30,50,14,16,"#9B95DD",2);rect(47,52,13,14,"#EA9D68",2);rect(63,49,15,17,"#83B9C7",2);rect(81,53,13,13,"#A3CC81",2);
  circle(101,72,17,"#FFFFFF");circle(101,72,12,"#95D4DD");circle(101,72,8,"#E3FAFB");
  path("M112 83 L126 97","none","#2D7A8B",6);break;
 }
 return svg;
};
AV.HOME_CARD_ART={palette:themes,badges,create};
})(globalThis.AV=globalThis.AV||{});
