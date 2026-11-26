(function (AV) {
  "use strict";
  /* Biblioteca de conteúdos: temas por etapa e componente, gerados sob demanda pela IA ou abertos como modelo. */
  AV.LIB = {
    etapas: ["Educação Infantil", "1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano", "Ensino Médio", "EJA"],
    tipos: [
      ["atividade", "Atividade para imprimir", "atividade"], ["lista", "Lista de exercícios", "lista"], ["prova", "Avaliação", "prova"],
      ["plano", "Plano de aula", "plano"], ["sequencia", "Sequência didática", "plano"], ["projeto", "Projeto", "projeto"],
      ["apostila", "Apostila / texto de apoio", "apostila"], ["interpretacao", "Interpretação de texto", "atividade"], ["ludica", "Atividade lúdica / jogo", "atividade"], ["roteiro", "Roteiro com QR codes", "roteiro"]
    ],
    /* segmento: inf (Ed. Infantil), ai (1º-5º), af (6º-9º), em (Médio) */
    temas: {
      "Língua Portuguesa": {
        inf: ["Letras do meu nome", "Rimas e parlendas", "Contação de histórias", "Vogais", "Cantigas de roda"],
        ai: ["Alfabeto e ordem alfabética", "Sílabas simples e complexas", "Encontros vocálicos e consonantais", "Substantivos próprios e comuns", "Adjetivos", "Verbos e tempos verbais", "Pontuação", "Fábulas", "Bilhete e carta", "Notícia", "Sinônimos e antônimos", "Acentuação", "Uso do dicionário", "Poemas"],
        af: ["Gêneros textuais", "Classes de palavras", "Concordância verbal e nominal", "Figuras de linguagem", "Crônica", "Texto argumentativo", "Orações coordenadas e subordinadas", "Variação linguística", "Fake news e checagem", "Conto de mistério"],
        em: ["Literatura brasileira: Modernismo", "Redação dissertativa-argumentativa (ENEM)", "Coesão e coerência", "Romantismo", "Análise de charges"]
      },
      "Matemática": {
        inf: ["Números de 1 a 10", "Formas geométricas", "Maior e menor", "Contagem com objetos", "Sequências e padrões"],
        ai: ["Sistema de numeração decimal", "Adição e subtração", "Multiplicação e tabuada", "Divisão", "Frações", "Números decimais", "Sistema monetário", "Medidas de comprimento", "Medidas de tempo", "Gráficos e tabelas", "Geometria: polígonos", "Problemas do dia a dia", "Perímetro e área"],
        af: ["Números inteiros", "Equações do 1º grau", "Razão e proporção", "Porcentagem", "Potenciação e radiciação", "Ângulos", "Teorema de Pitágoras", "Estatística e probabilidade", "Sistemas de equações", "Funções"],
        em: ["Função afim e quadrática", "Progressões", "Trigonometria", "Matemática financeira", "Análise combinatória", "Geometria espacial"]
      },
      "Ciências": {
        inf: ["Partes do corpo", "Animais da fazenda", "Plantas e sementes", "Água no dia a dia", "Dia e noite"],
        ai: ["Seres vivos e não vivos", "Ciclo da água", "Corpo humano", "Alimentação saudável", "Sistema Solar", "Plantas: partes e funções", "Cadeia alimentar", "Estados físicos da água", "Higiene e saúde", "Reciclagem e lixo", "Microrganismos", "Misturas"],
        af: ["Células", "Ecossistemas brasileiros", "Cerrado", "Sistema digestório", "Energia e suas fontes", "Reprodução humana e puberdade", "Vacinas", "Tabela periódica", "Clima e aquecimento global", "Genética básica"],
        em: ["Ecologia", "Química orgânica", "Leis de Newton", "Biotecnologia", "Eletricidade"]
      },
      "História": {
        inf: ["Minha família", "Brincadeiras de antigamente", "Minha escola"],
        ai: ["Minha história e documentos", "Comunidade e bairro", "Povos indígenas", "Patrimônio cultural", "Migrações", "Formação do município", "Escravidão e resistência", "Brasil Colônia"],
        af: ["Pré-história", "Grécia e Roma antigas", "Idade Média", "Grandes navegações", "Independência do Brasil", "Revolução Industrial", "Era Vargas", "Ditadura militar", "Guerras mundiais"],
        em: ["Revolução Francesa", "Guerra Fria", "Redemocratização do Brasil", "História de Goiás"]
      },
      "Geografia": {
        inf: ["Lugares que conheço", "Caminho de casa até a escola"],
        ai: ["Paisagem natural e modificada", "Campo e cidade", "Pontos cardeais", "Mapas e legendas", "Meu município", "Regiões do Brasil", "Migrações e trabalho", "Relevo e hidrografia", "Rio Verde: conhecer para pertencer"],
        af: ["Cartografia", "Biomas brasileiros", "Urbanização", "Agronegócio e meio ambiente", "Clima e vegetação", "Globalização", "População brasileira", "Continentes"],
        em: ["Geopolítica atual", "Questão agrária", "Recursos hídricos", "Geografia de Goiás"]
      },
      "Língua Inglesa": {
        ai: ["Colors and numbers", "Animals", "Family members", "Greetings"],
        inf: ["Colors and shapes", "Animals and sounds", "Hello song and greetings"],
        af: ["Verb to be", "Simple present", "Present continuous", "Daily routine", "Simple past", "Food and drinks", "There is / there are", "Can for ability", "Comparatives"],
        em: ["Reading strategies", "Future tenses", "Phrasal verbs", "English for ENEM", "Modal verbs"]
      },
      "Língua Espanhola": {
        ai: ["Saludos y presentaciones", "Colores y números", "La familia", "Los animales"],
        af: ["Verbos en presente", "La casa y los muebles", "La rutina diaria", "Comidas y bebidas", "Países hispanohablantes", "Pretérito indefinido"],
        em: ["Comprensión lectora", "Textos argumentativos", "Cultura hispana", "Español para el ENEM"]
      },
      "Arte": {
        inf: ["Cores primárias", "Música e movimento"],
        ai: ["Artistas brasileiros", "Folclore", "Arte indígena", "Releitura de obras", "Instrumentos musicais"],
        af: ["Arte moderna", "Teatro", "Cultura afro-brasileira", "Arte urbana"]
      },
      "Educação Física": {
        inf: ["Circuito motor", "Brincadeiras cantadas"],
        ai: ["Brincadeiras e jogos populares", "Jogos cooperativos", "Ginástica", "Esportes de invasão"],
        af: ["Esportes coletivos", "Lutas", "Saúde e atividade física", "Jogos olímpicos"]
      },
      "Ensino Religioso": { ai: ["Respeito às diferenças", "Valores e convivência"], af: ["Diversidade religiosa", "Ética e cidadania"] },
      "Projeto de vida / Socioemocional": { ai: ["Emoções e sentimentos", "Amizade", "Bullying não!"], af: ["Projeto de vida", "Educação financeira", "Cidadania digital"], em: ["Mundo do trabalho", "Escolha profissional"] }
    },
    /* Datas comemorativas e temas do calendário escolar [mês, dia, nome, sugestão] */
    datas: [
      [2, 0, "Volta às aulas", "Acolhimento, combinados da turma e apresentação"], [2, 0, "Carnaval", "Marchinhas, máscaras e cultura popular"],
      [3, 8, "Dia Internacional da Mulher", "Mulheres que mudaram a história"], [3, 15, "Dia da Escola", "A escola dos sonhos"], [3, 21, "Dia Internacional contra a Discriminação Racial", "Respeito e igualdade"], [3, 22, "Dia Mundial da Água", "Uso consciente da água"], [3, 0, "Páscoa", "Partilha e tradições"],
      [4, 7, "Dia Mundial da Saúde", "Hábitos saudáveis"], [4, 18, "Dia Nacional do Livro Infantil", "Monteiro Lobato e o prazer de ler"], [4, 19, "Dia dos Povos Indígenas", "Diversidade dos povos originários"], [4, 21, "Tiradentes", "Inconfidência Mineira"], [4, 22, "Descobrimento do Brasil", "Chegada dos portugueses e povos que já viviam aqui"],
      [5, 1, "Dia do Trabalho", "Profissões e direitos"], [5, 13, "Abolição da escravatura", "Resistência e cultura afro-brasileira"], [5, 0, "Dia das Mães", "Famílias e afeto"], [5, 18, "Combate ao abuso e exploração sexual infantil", "Proteção e direitos da criança"],
      [6, 5, "Dia do Meio Ambiente", "Cerrado, reciclagem e sustentabilidade"], [6, 0, "Festa Junina", "Comidas típicas, quadrilha e cultura do campo"],
      [7, 0, "Férias e brincadeiras", "Brincadeiras de antigamente"],
      [8, 11, "Dia do Estudante", "Direitos e deveres do estudante"], [8, 22, "Dia do Folclore", "Lendas e personagens do folclore"], [8, 25, "Dia do Soldado", "Cidadania"], [8, 0, "Dia dos Pais", "Famílias diversas"],
      [9, 7, "Independência do Brasil", "Símbolos nacionais"], [9, 21, "Dia da Árvore", "Árvores do Cerrado"], [9, 23, "Início da primavera", "Flores e estações do ano"], [9, 0, "Setembro Amarelo", "Valorização da vida e emoções"],
      [10, 4, "Dia dos Animais", "Proteção animal"], [10, 12, "Dia das Crianças", "Direitos da criança (ECA)"], [10, 15, "Dia do Professor", "Homenagens e memórias"], [10, 0, "Outubro Rosa", "Cuidado e prevenção"],
      [11, 15, "Proclamação da República", "Formas de governo"], [11, 19, "Dia da Bandeira", "Símbolos nacionais"], [11, 20, "Dia da Consciência Negra", "Zumbi, Dandara e a cultura afro-brasileira"],
      [12, 3, "Dia Internacional da Pessoa com Deficiência", "Inclusão e acessibilidade"], [12, 0, "Natal e encerramento do ano", "Retrospectiva, cartas e solidariedade"]
    ]
  };
  AV.LIB.segmento = (etapa) => (etapa === "Educação Infantil" ? "inf" : /^[1-5]º/.test(etapa) ? "ai" : /^[6-9]º/.test(etapa) ? "af" : etapa === "Ensino Médio" ? "em" : "af");
  AV.MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
})(globalThis.AV = globalThis.AV || {});
