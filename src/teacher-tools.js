(function(AV){
"use strict";
const h=AV.h, V=AV.views;
const get=(k,d)=>AV.LS.get(k,d);
const set=(k,v)=>AV.LS.set(k,v);
const prefs=()=>Object.assign({agenda:true,schedule:true,quote:true,quickStudy:true},get("homeWidgets",{}));
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const notes=()=>get("teacherAgenda",[]);
const classes=()=>get("teacherSchedule",[]);
const quotes=[
"Uma explicação clara pode abrir caminhos para muitas descobertas.",
"Aprender exige curiosidade; ensinar exige escuta.",
"Uma boa pergunta pode transformar toda a aula.",
"A prática frequente faz o conhecimento ganhar significado.",
"Cada turma tem seu ritmo; planejar também é adaptar.",
"Ensinar é criar oportunidades para que outros pensem por si.",
"Uma aula significativa começa com um propósito compreensível.",
"Registrar ideias hoje ajuda a construir projetos amanhã.",
"Revisar é uma parte essencial de escrever bem.",
"Ouvir os estudantes também faz parte do ensino.",
"A leitura amplia o repertório para argumentar melhor.",
"Um pequeno progresso merece ser observado.",
"Atividades variadas ajudam a alcançar formas diferentes de aprender.",
"Conhecimento compartilhado cresce na troca de experiências."
];
function quote(){const d=today().replace(/-/g,"");let hash=0;for(const c of d)hash=(hash*31+c.charCodeAt(0))>>>0;return quotes[hash%quotes.length];}
function action(text,fn,cls){return h("button",{type:"button",class:"btn "+(cls||"sm"),onclick:fn},text);}
function wrap(title,desc,...kids){return h("section",{class:"card teacher-tool"},h("h2",null,title),desc?h("p",{class:"muted small"},desc):null,...kids);}
function notice(t){AV.toast(t);}
function textInput(label,value,placeholder){const i=h("input",{class:"in",value:value||"",placeholder:placeholder||""});return [h("label",{class:"f"},label,i),i];}
function agendaList(box,compact){
 box.textContent="";
 const items=notes().slice().sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")));
 if(!items.length){box.append(h("p",{class:"muted small"},"Nenhum lembrete salvo. Anote uma reunião, entrega ou tarefa."));return;}
 items.slice(0,compact?3:100).forEach(n=>box.append(h("div",{class:"teacher-entry"},h("div",null,h("strong",null,n.title),h("div",{class:"small muted"},n.date?new Date(n.date+"T12:00:00").toLocaleDateString("pt-BR"):"Sem data",n.detail?" · "+n.detail:"")),h("div",{class:"row"},action(n.done?"Reabrir":"Concluir",()=>{set("teacherAgenda",notes().map(x=>x.id===n.id?Object.assign({},x,{done:!x.done}):x));agendaList(box,compact);},n.done?"sm ghost":"sm"),!compact?action("Excluir",()=>{set("teacherAgenda",notes().filter(x=>x.id!==n.id));agendaList(box,false);},"sm ghost"):null)));
 }
function scheduleList(box,compact){
 box.textContent="";
 const days=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
 const items=classes().slice().sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start));
 if(!items.length){box.append(h("p",{class:"muted small"},"Horário de aulas ainda não configurado."));return;}
 items.slice(0,compact?4:100).forEach(n=>box.append(h("div",{class:"teacher-entry"},h("span",null,h("strong",null,days[n.day]+" "+n.start),h("div",{class:"small muted"},n.subject+" · "+n.group+(n.room?" · "+n.room:""))),!compact?action("Excluir",()=>{set("teacherSchedule",classes().filter(x=>x.id!==n.id));scheduleList(box,false);},"sm ghost"):null));
}
V.agenda={title:"Agenda",render(main){
 const list=h("div",{class:"teacher-list"});
 const title=h("input",{class:"in",maxlength:120,placeholder:"Ex.: Reunião pedagógica"});
 const date=h("input",{class:"in",type:"date",value:today()});
 const detail=h("textarea",{class:"in",rows:2,placeholder:"Informações importantes (opcional)"});
 const save=()=>{const t=title.value.trim();if(!t)return notice("Informe um título.");if(notes().length>=300)return notice("Limite de 300 lembretes neste dispositivo.");set("teacherAgenda",notes().concat({id:AV.uid(),title:t,date:date.value,detail:detail.value.trim().slice(0,2000),done:false}));title.value="";detail.value="";agendaList(list,false);notice("Lembrete salvo no cofre local.");};
 main.append(h("div",{class:"wrap"},AV.pageHead("Agenda do professor","Reuniões, prazos, recados e tarefas. Os registros ficam no seu cofre local criptografado.","calendar","violet"),wrap("Novo lembrete",null,h("div",{class:"form"},h("label",{class:"f"},"Título",title),h("label",{class:"f"},"Data",date),h("label",{class:"f full"},"Detalhes",detail)),action("Salvar lembrete",save,"pri")),wrap("Meus lembretes",null,list)));
 agendaList(list,false);
}};
V.horarios={title:"Horários de aula",render(main){
 const list=h("div",{class:"teacher-list"});
 const day=h("select",{class:"in"},["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"].map((d,i)=>h("option",{value:i,selected:i===1},d)));
 const start=h("input",{class:"in",type:"time",value:"07:00"});
 const subject=h("input",{class:"in",placeholder:"Ex.: Matemática"});
 const group=h("input",{class:"in",placeholder:"Ex.: 5º ano A"});
 const room=h("input",{class:"in",placeholder:"Sala (opcional)"});
 const save=()=>{if(!subject.value.trim()||!group.value.trim()||!start.value)return notice("Informe disciplina, turma e horário.");if(classes().length>=150)return notice("Limite de 150 aulas nesta agenda.");set("teacherSchedule",classes().concat({id:AV.uid(),day:+day.value,start:start.value,subject:subject.value.trim().slice(0,90),group:group.value.trim().slice(0,90),room:room.value.trim().slice(0,90)}));scheduleList(list,false);notice("Horário registrado.");};
 main.append(h("div",{class:"wrap"},AV.pageHead("Horários de aula","Monte sua grade semanal com disciplinas, turmas e salas.","calendar","blue"),wrap("Adicionar aula",null,h("div",{class:"form"},h("label",{class:"f"},"Dia",day),h("label",{class:"f"},"Início",start),h("label",{class:"f"},"Disciplina",subject),h("label",{class:"f"},"Turma",group),h("label",{class:"f"},"Sala",room)),action("Adicionar",save,"pri")),wrap("Grade semanal",null,list,action("Exportar CSV",()=>{const rows=[["Dia","Hora","Disciplina","Turma","Sala"]].concat(classes().map(x=>[x.day,x.start,x.subject,x.group,x.room]));AV.saveFile("aulas-horarios.csv","\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(";")).join("\r\n"));},"sm"))));
 scheduleList(list,false);
}};
const study=[
["Planejamento","Defina um objetivo observável por aula e evidências de aprendizagem antes de escolher as atividades."],
["Clareza textual","Abra com uma ideia central, desenvolva um parágrafo por argumento e conclua retomando o propósito."],
["Coesão","Use conectivos de comparação, causa, consequência e conclusão somente quando houver relação lógica."],
["Revisão","Faça duas leituras: uma para conteúdo e sequência das ideias; outra para ortografia, pontuação e concordância."],
["Fontes","Priorize documentos oficiais, artigos identificáveis e publicações com autoria e data; confira referências."],
["Citações","Diferencie citação literal de paráfrase. Registre autor, ano e página quando exigida pela modalidade de citação."],
["Feedback","Mostre ao aluno o que foi bem, a próxima ação concreta e uma oportunidade de revisar."],
["Avaliação formativa","Use uma pergunta curta de saída da aula para identificar dúvidas e planejar a retomada."],
["Inclusão","Ofereça mais de uma forma de apresentar conceitos e alternativas para demonstrar aprendizagem."],
["Leitura crítica","Pergunte quem escreveu, quando, com qual evidência e para qual público; diferencie fato e opinião."],
["Produção textual","Planeje público, gênero, tese, argumentos e repertório antes do primeiro rascunho."],
["Prática distribuída","Retome ideias importantes em aulas diferentes, em vez de concentrar toda a revisão num único dia."]
];
V.estudos={title:"Ambiente de estudos",render(main){
 const search=h("input",{class:"in",type:"search",placeholder:"Pesquisar dicas de escrita, aula, pesquisa..."});
 const list=h("div",{class:"grid wide"});
 const draw=()=>{list.textContent="";study.filter(([a,b])=>(a+" "+b).toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).forEach(([a,b])=>list.append(wrap(a,b,action("Criar material sobre isso",()=>AV.aiCreateDialog({topic:a+" — "+b,kind:"roteiro"}),"sm"))));if(!list.children.length)list.append(h("p",null,"Nenhuma dica encontrada."));};
 search.addEventListener("input",draw);
 main.append(h("div",{class:"wrap"},AV.pageHead("Ambiente de estudos","Orientações práticas de escrita, revisão, didática e pesquisa.","book","teal"),search,list,h("p",{class:"muted small"},"Estas orientações são gerais e não substituem o currículo da rede, a leitura das normas técnicas nem avaliação profissional.")));draw();
}};
const abntModels=[
["Artigo acadêmico","Introdução\n\nApresente o tema, a questão central e o objetivo.\n\nDesenvolvimento\n\nDesenvolva os argumentos com fundamentação e citações verificadas.\n\nConsiderações finais\n\nRetome o objetivo e destaque as contribuições.\n\nReferências\n\nInclua as obras efetivamente consultadas."],
["Projeto de pesquisa","Introdução\n\nContextualize o problema.\n\nJustificativa\n\nExplique a relevância do estudo.\n\nObjetivos\n\nApresente o objetivo geral e os específicos.\n\nMetodologia\n\nDescreva procedimentos e critérios.\n\nCronograma\n\nOrganize as etapas por período.\n\nReferências\n\nListe as fontes utilizadas."],
["Relatório acadêmico","Introdução\n\nContexto e propósito do trabalho.\n\nMetodologia\n\nDescreva a realização da atividade.\n\nResultados e discussão\n\nApresente e analise os resultados.\n\nConclusão\n\nSintetize os resultados.\n\nReferências\n\nInclua as fontes utilizadas."],
["Resenha crítica","Referência da obra\n\nIdentifique a obra analisada.\n\nApresentação\n\nApresente a temática e o objetivo.\n\nSíntese\n\nResuma as ideias centrais sem copiar o texto.\n\nAnálise crítica\n\nDiscuta limites, contribuições e argumentos.\n\nConclusão\n\nApresente a avaliação fundamentada."],
["Plano de aula","Identificação\n\nEscola, turma, disciplina e duração.\n\nObjetivos\n\nResultados esperados da aprendizagem.\n\nConteúdos\n\nConceitos e habilidades.\n\nMetodologia\n\nEtapas e recursos.\n\nAvaliação\n\nEvidências a observar.\n\nReferências\n\nFontes utilizadas."]
];
function abntHTML(t,title,author,institution,font){
 const escape=AV.esc;
 const sections=t.trim().split(/\n\s*\n/).filter(Boolean).map(p=>"<p>"+escape(p).replace(/\n/g,"<br>")+"</p>").join("");
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+escape(title)+'</title><style>@page{size:A4;margin:3cm 2cm 2cm 3cm}body{font-family:'+font+',serif;font-size:12pt;line-height:1.5;color:#111}p{margin:0 0 12pt;text-align:justify;text-indent:1.25cm}h1,h2{text-align:center}section{page-break-after:always}@media print{button{display:none}}</style></head><body><section><h2>'+escape(institution)+'</h2><h2>'+escape(author)+'</h2><h1>'+escape(title)+'</h1></section>'+sections+'</body></html>';
}
V.abnt={title:"Editor ABNT",render(main){
 const saved=get("abntEditor",{});
 const title=h("input",{class:"in",value:saved.title||"Meu trabalho acadêmico",maxlength:180});
 const author=h("input",{class:"in",value:saved.author||AV.profile().name||""});
 const institution=h("input",{class:"in",value:saved.institution||AV.profile().school||""});
 const font=h("select",{class:"in"},["Times New Roman","Arial"].map(v=>h("option",{value:v,selected:v===(saved.font||"Times New Roman")},v)));
 const content=h("textarea",{class:"in",rows:18,placeholder:"Escreva o texto aqui. Separe parágrafos com uma linha em branco."},saved.text||"");
 const preview=h("div",{class:"abnt-paper"});
 const status=h("p",{class:"small muted","aria-live":"polite"});
 const fields=h("div",{class:"form"},h("label",{class:"f"},"Título",title),h("label",{class:"f"},"Autor",author),h("label",{class:"f"},"Instituição",institution),h("label",{class:"f"},"Fonte",font));
 const save=()=>{set("abntEditor",{title:title.value,author:author.value,institution:institution.value,font:font.value,text:content.value});status.textContent="Rascunho salvo no cofre local.";};
 const draw=()=>{preview.textContent="";preview.style.fontFamily=font.value;content.value.split(/\n\s*\n/).filter(Boolean).forEach(p=>preview.append(h("p",null,p)));};
 const deb=AV.debounce(()=>{save();draw();},500);
 [title,author,institution,font,content].forEach(i=>i.addEventListener("input",deb));
 const exportHTML=()=>AV.saveFile(AV.slug(title.value)+".html",abntHTML(content.value,title.value,author.value,institution.value,font.value));
 const exportDOCX=async()=>{
  try{await AV.loadScript(AV.LIBS.docx);const D=window.docx;if(!D||!D.Document)throw Error("Biblioteca DOCX indisponível.");
   const paras=[new D.Paragraph({text:institution.value,alignment:D.AlignmentType.CENTER}),new D.Paragraph({text:author.value,alignment:D.AlignmentType.CENTER}),new D.Paragraph({text:title.value,alignment:D.AlignmentType.CENTER,pageBreakBefore:false}),...content.value.split(/\n\s*\n/).filter(Boolean).map(t=>new D.Paragraph({text:t.replace(/\n/g," "),alignment:D.AlignmentType.JUSTIFIED,indent:{firstLine:709},spacing:{line:360}}))];
   const doc=new D.Document({styles:{default:{document:{run:{font:font.value,size:24},paragraph:{spacing:{line:360}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1701,left:1701,bottom:1134,right:1134}}},children:paras}]});
   await AV.saveFile(AV.slug(title.value)+".docx",await D.Packer.toBlob(doc));status.textContent="DOCX exportado. Revise as regras específicas da sua instituição.";
  }catch(e){status.textContent="Não foi possível exportar DOCX: "+e.message;}
 };
 const print=()=>{const blob=new Blob([abntHTML(content.value,title.value,author.value,institution.value,font.value)],{type:"text/html"});const url=URL.createObjectURL(blob);const w=window.open(url,"_blank","noopener");if(!w)notice("Permita pop-ups para imprimir ou baixe HTML.");setTimeout(()=>URL.revokeObjectURL(url),60000);};
 main.append(h("div",{class:"wrap"},AV.pageHead("Editor de textos — ABNT","Rascunho, estrutura acadêmica, prévia A4 e exportação. Revise o manual de sua instituição.","book","blue"),wrap("Configuração do trabalho","A4 · margens superior/esquerda 3 cm, inferior/direita 2 cm · corpo 12 pt · espaçamento 1,5.",fields,h("div",{class:"row"},abntModels.map(([label,body])=>action(label,()=>{if(content.value.trim()&&!confirm("Substituir o texto atual pelo modelo "+label+"?"))return;content.value=body;deb.cancel();save();draw();},"sm")))),h("div",{class:"teacher-editor"},wrap("Texto",null,content,h("div",{class:"row"},action("Salvar",save,"sm"),action("Word (.docx)",exportDOCX,"pri"),action("HTML A4",exportHTML,"sm"),action("Abrir para imprimir/PDF",print,"sm")),status),wrap("Prévia de leitura","A aparência é aproximada; use o arquivo exportado para conferência final.",preview)),h("p",{class:"muted small"},"Referência: NBR 14724:2024, NBR 10520:2023 (citações) e NBR 6023 (referências). Esta versão não valida automaticamente a conformidade de citações, referências, numeração ou sumário.")));draw();
}};
AV.teacherHomeWidgets=function(){
 const p=prefs(),box=h("div",{class:"teacher-home"});
 const cards=[];
 if(p.agenda){const list=h("div",{class:"teacher-list"});agendaList(list,true);cards.push(wrap("Agenda","Seus próximos lembretes",list,h("a",{class:"btn sm",href:"#agenda"},"Abrir agenda")));}
 if(p.schedule){const list=h("div",{class:"teacher-list"});scheduleList(list,true);cards.push(wrap("Horários de aula","A sua grade semanal",list,h("a",{class:"btn sm",href:"#horarios"},"Ver horários")));}
 if(p.quote)cards.push(wrap("Mensagem do dia","Uma ideia para inspirar o planejamento",h("blockquote",{class:"daily-quote"},quote())));
 if(p.quickStudy)cards.push(wrap("Cantinho de estudos","Escrita, revisão e práticas docentes",h("p",{class:"small"},"Planeje, escreva, revise e registre boas fontes."),h("div",{class:"row"},h("a",{class:"btn sm",href:"#estudos"},"Dicas"),h("a",{class:"btn sm",href:"#abnt"},"Editor ABNT"))));
 if(cards.length)box.append(h("div",{class:"sec-t"},h("div",null,h("small",null,"Sua rotina"),h("h2",null,"Meu espaço de trabalho")),h("a",{href:"#config"},"Personalizar")),h("div",{class:"teacher-home-grid"},cards));
 return box;
};
AV.homeWidgetSettings=function(){
 const p=prefs(),labels={agenda:"Agenda e lembretes",schedule:"Horários de aula",quote:"Mensagem motivacional diária",quickStudy:"Atalhos de estudo e ABNT"};
 return wrap("Personalizar tela inicial","Escolha quais áreas aparecem na sua página inicial. Essas opções não apagam os dados.",Object.keys(labels).map(k=>h("label",{class:"check"},h("input",{type:"checkbox",checked:!!p[k],onchange:e=>{const latest=prefs();latest[k]=e.target.checked;set("homeWidgets",latest);notice("Preferências salvas. Volte ao início para conferir.");}}),labels[k])));
};
})(globalThis.AV=globalThis.AV||{});
