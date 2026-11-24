(function(AV){
"use strict";
/* 50 roteiros originais, editáveis, construídos a partir de tipos de atividades
   já suportados pelo AulaViva. Não são 50 motores novos nem cópias de materiais externos. */
const topics=[
 ["Animais brasileiros","onça,tamanduá,arara,capivara,anta"],
 ["Meio ambiente","água,floresta,reciclagem,energia,solo"],
 ["Alimentação saudável","fruta,legume,arroz,feijão,água"],
 ["Corpo humano","coração,pulmão,cérebro,ossos,músculo"],
 ["Sistema Solar","Sol,Terra,Lua,Marte,Saturno"]
];
const P=[];
function add(type,category,fn){topics.forEach((t,i)=>{const p=fn(t,i);P.push({id:"act-"+type+"-"+i,name:p.name||category+" — "+t[0],category,activityId:type,description:p.description||"Material original que pode ser alterado antes de gerar.",values:p.values});});}
add("wordSearch","Caça-palavras temático",t=>({name:"Caça-palavras: "+t[0],values:{title:"Descobertas: "+t[0],words:t[1].split(","),size:14,dirV:true,dirD:true,dirR:false}}));
add("crossword","Cruzadinha temática",t=>({name:"Cruzadinha: "+t[0],values:{title:"Cruzadinha de "+t[0],entries:t[1].split(",").map(w=>[w,"Palavra relacionada ao tema "+t[0]+": "+w])}}));
add("scramble","Letras embaralhadas",t=>({name:"Descubra as palavras: "+t[0],values:{prompt:"Organize as letras para formar palavras sobre "+t[0]+".",words:t[1].split(","),format:"tabela"}}));
add("alphabetical","Ordem alfabética",t=>({name:"Organize palavras: "+t[0],values:{prompt:"Coloque em ordem alfabética as palavras de "+t[0]+":",words:t[1].split(",")}}));
add("fillBlank","Leitura com lacunas",(t,i)=>{const sentences=[
"O [tamanduá] e a [onça] são animais brasileiros. A [arara] é uma ave.",
"A [água] é importante para a vida. Cuidar da [floresta] ajuda o planeta.",
"As [frutas] e os [legumes] fazem parte de uma alimentação variada.",
"O [coração] bombeia o sangue. Os [pulmões] participam da respiração.",
"O [Sol] é uma estrela. A [Terra] é um planeta e a [Lua] é seu satélite natural."
];return{name:"Complete o texto: "+t[0],values:{prompt:"Leia e complete as lacunas sobre "+t[0]+".",text:sentences[i],words:[]}};});
add("match","Relacionar conceitos",(t,i)=>{const pairs=[
[["onça","mamífero"],["arara","ave"],["capivara","mamífero"],["tamanduá","mamífero"]],
[["água","recurso natural"],["floresta","ecossistema"],["reciclagem","reaproveitamento"],["solo","sustenta as plantas"]],
[["frutas","vitaminas e fibras"],["feijão","leguminosa"],["água","hidratação"],["arroz","cereal"]],
[["coração","circulação"],["pulmão","respiração"],["cérebro","sistema nervoso"],["ossos","sustentação"]],
[["Sol","estrela"],["Terra","planeta"],["Lua","satélite natural"],["Saturno","planeta com anéis"]]
];return{name:"Ligue os pares: "+t[0],values:{prompt:"Relacione corretamente os conceitos sobre "+t[0]+".",pairs:pairs[i]}};});
add("trueFalseFromFacts","Verdadeiro ou falso",(t,i)=>{const facts=[
"Araras são aves. | V\nCapivaras são insetos. | F\nOnças são mamíferos. | V",
"A reciclagem pode reduzir resíduos. | V\nA água é ilimitada. | F\nPlantas dependem de condições ambientais. | V",
"Beber água é importante. | V\nToda fruta é igual em nutrientes. | F\nUma alimentação variada é recomendada. | V",
"O coração participa da circulação. | V\nOs pulmões fazem digestão. | F\nO cérebro coordena funções do corpo. | V",
"O Sol é uma estrela. | V\nA Lua possui luz própria. | F\nA Terra gira ao redor do Sol. | V"
];return{name:"V ou F: "+t[0],values:{prompt:"Avalie as afirmações sobre "+t[0]+".",facts:facts[i]}};});
add("quiz","Quiz contextualizado",(t,i)=>{const qs=[
"Qual destes é uma ave brasileira?\nOnça\n*Arara\nCapivara\n\nQual é um mamífero?\n*Anta\nBorboleta\nAbelha",
"Qual atitude ajuda a reduzir o lixo?\n*Separar recicláveis\nDescartar no rio\nQueimar resíduos\n\nO que as plantas precisam?\n*Água\nPlástico\nFumaça",
"Qual bebida contribui para hidratação?\n*Água\nRefrigerante como única bebida\nNenhuma\n\nQual alimento é leguminosa?\n*Feijão\nArroz\nÓleo",
"Qual órgão bombeia sangue?\n*Coração\nPulmão\nEstômago\n\nQual órgão participa da respiração?\n*Pulmão\nCérebro\nOsso",
"Qual é uma estrela?\n*Sol\nTerra\nLua\n\nQual é o satélite natural da Terra?\n*Lua\nMarte\nSaturno"
];return{name:"Quiz: "+t[0],values:{questions:qs[i],shuffle:true}};});
add("sentenceOrder","Frases para ordenar",(t,i)=>{const sentences=[
"A arara voa na floresta.\nA capivara vive perto da água.",
"A água é importante para todos.\nAs árvores ajudam o ambiente.",
"Frutas e legumes podem fazer parte da alimentação.\nBeber água é importante.",
"O coração bate continuamente.\nO cérebro coordena várias ações.",
"A Terra gira ao redor do Sol.\nA Lua acompanha a Terra."
];return{name:"Organize frases: "+t[0],values:{prompt:"Coloque as palavras na ordem correta.",sentences:sentences[i]}};});
add("mathOps","Matemática contextualizada",(t,i)=>({name:"Desafios numéricos: "+t[0],description:"Operações para adaptar a um problema contextualizado em "+t[0]+".",values:{op:i%2?"mix":"+",count:10,min:2,max:i>2?50:20,noNegative:true,exactDivision:true,format:"lista"}}));
AV.ACTIVITY_PRESETS=P;
})(globalThis.AV=globalThis.AV||{});
