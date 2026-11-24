(function(AV){
"use strict";
/* 15 modelos originais adicionais: educação infantil, anos iniciais e finais.
   São roteiros editáveis — nenhum material de terceiros é reproduzido. */
const entries=[
["boas-vindas","Um dia de boas-vindas","Convivência","sala","professora","Vamos nos conhecer e respeitar o jeito de cada pessoa.","Combinados da turma","Escutar e acolher fortalece a turma."],
["leitura","A aventura de ler","Língua Portuguesa","biblioteca","menina","Ler abre portas para histórias, informações e ideias.","Leitura","Ao ler, podemos perguntar e descobrir."],
["reciclar","Cuidando dos resíduos","Ciências","parque","menino","Separar resíduos ajuda o reaproveitamento de materiais.","Reciclagem","Reduzir e reutilizar também são importantes."],
["fracao","Frações na prática","Matemática","sala","professora","Uma fração representa partes de um todo dividido igualmente.","Frações","Duas metades formam um inteiro."],
["formas","Caça às formas geométricas","Matemática","parque","menina","Círculos, triângulos e quadrados aparecem no cotidiano.","Formas geométricas","Vamos observar as formas dos objetos."],
["plantas","Da semente à planta","Ciências","fazenda","flor","Uma semente pode germinar quando encontra condições adequadas.","Germinação","Água, ar e temperatura influenciam o desenvolvimento."],
["higiene","Cuidados com as mãos","Saúde","sala","menina","Lavar as mãos com água e sabão ajuda a reduzir microrganismos.","Higiene","Cuidar da higiene faz parte da saúde."],
["transito","Caminho seguro","Cidadania","cidade","menino","Na rua, observe a sinalização e atravesse em local apropriado.","Trânsito seguro","Respeitar as regras protege a todos."],
["emocao","Reconhecendo emoções","Convivência","parque","menina","Sentir alegria, medo ou tristeza faz parte da experiência humana.","Emoções","Conversar com alguém de confiança pode ajudar."],
["agua","Água no cotidiano","Ciências","parque","gota","A água é essencial para seres vivos e atividades diárias.","Uso da água","Evitar desperdício é uma atitude importante."],
["mapa","Descobrindo os mapas","Geografia","sala","professora","Mapas representam lugares usando símbolos e escalas.","Orientação","Observe legendas, títulos e pontos de referência."],
["tempo","Ontem, hoje e amanhã","História","sala","menina","Podemos organizar acontecimentos em uma linha do tempo.","Linha do tempo","Memórias e registros ajudam a compreender mudanças."],
["multiplicacao","Multiplicar em grupos","Matemática","sala","menino","Três grupos de dois objetos formam seis objetos.","Multiplicação","Contar grupos iguais facilita alguns cálculos."],
["inclusao","Todos participam","Convivência","sala","professora","As pessoas aprendem de modos diferentes, e todas merecem respeito.","Inclusão","Adaptar atividades pode ampliar a participação."],
["ciencia","Perguntar e investigar","Ciências","parque","menina","Uma investigação começa com perguntas e observações.","Investigação","Registre o que encontrou e compare com a hipótese."]
];
const A=(type,x,y,more)=>Object.assign({type,x,y,scale:1,anim:"acenar"},more||{});
const T=(text)=>({text,x:0.5,y:0.15,size:1,anim:"aparecer",color:"#FFFFFF"});
const BG=new Set(Object.keys(AV.anim?.BACKGROUNDS||{}));
const ACT=new Set(Object.keys(AV.anim?.ACTORS||{}));
const useBG=(v)=>BG.has(v)?v:"sala";
const useACT=(v)=>ACT.has(v)?v:"menina";
const newTemplates=entries.map(([id,title,subject,bg,actor,start,keyword,end])=>({
 id:"extra-"+id,title,subject,level:"Educação Básica",description:"Roteiro original sobre "+subject.toLowerCase()+", editável cena por cena.",
 story:{title,lang:"pt-BR",scenes:[
  {bg:useBG(bg),duration:6,narration:start,actors:[A(useACT(actor),0.37,0.84,{say:"Vamos descobrir?"})],texts:[T(title)]},
  {bg:useBG(bg),duration:6,narration:end,actors:[A(useACT(actor),0.57,0.84,{anim:"pular"})],texts:[T(keyword)]},
  {bg:useBG(bg),duration:6,narration:"Agora conte com suas palavras o que você aprendeu sobre "+keyword.toLowerCase()+".",actors:[A(useACT(actor),0.4,0.84,{say:"E você, o que pensa?"})],texts:[T("Sua vez de participar!")]}
 ]}}));
AV.anim.TEMPLATES=(AV.anim.TEMPLATES||[]).concat(newTemplates);
})(globalThis.AV=globalThis.AV||{});
