(function (AV) {
  "use strict";
  const h = AV.h;
  const copy = {
    pt: ["Agenda do professor", "Organizar", "Nenhum lembrete pendente.", "Novo lembrete", "Data", "Adicionar", "Concluir", "Mensagem do dia", "Comece com uma boa pergunta. Ela pode abrir caminhos para a turma inteira.", "Dê tempo para a descoberta. Uma pausa também faz parte da aula.", "Uma ideia que um aluno compartilha pode ajudar outro a aprender.", "Hoje, celebre uma pequena conquista da sua turma."],
    en: ["Teacher planner", "Manage", "No pending reminders.", "New reminder", "Date", "Add", "Complete", "Thought of the day", "Start with a good question. It can open doors for the whole class.", "Leave room for discovery. A pause is part of learning.", "An idea shared by one student can help another learn.", "Celebrate a small achievement in your class today."],
    es: ["Agenda docente", "Organizar", "No hay recordatorios pendientes.", "Nuevo recordatorio", "Fecha", "Añadir", "Completar", "Mensaje del día", "Empieza con una buena pregunta. Puede abrir caminos para toda la clase.", "Da tiempo al descubrimiento. Una pausa también forma parte de la clase.", "Una idea que comparte un estudiante puede ayudar a otro a aprender.", "Celebra hoy un pequeño logro de tu clase."]
  };
  const dateKey = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  AV.homePlanner = function () {
    const [agenda, manage, empty, reminder, date, add, complete, daily, ...messages] = copy[AV.lang()] || copy.pt;
    const upcoming = h("div", { class: "planner-preview" });
    const quote = h("p", null);
    const entries = () => AV.LS.get("agenda", []).sort((a, b) => a.date.localeCompare(b.date));
    function item(entry) {
      const local = new Date(entry.date + "T12:00:00");
      return h("div", { class: "planner-entry" }, h("time", { datetime: entry.date }, local.toLocaleDateString(AV.locale(), {day:"numeric", month:"short", year:"numeric"})), h("span", null, entry.text));
    }
    function refresh() {
      const first = entries()[0];
      upcoming.replaceChildren(first ? item(first) : empty);
      const now = new Date();
      const day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
      quote.textContent = messages[day % messages.length];
    }
    function openPlanner() {
      const input = h("input", { required: true, maxlength: 240 });
      const when = h("input", { type: "date", required: true, value: dateKey(new Date()) });
      const list = h("div", { class: "planner-list" });
      function draw() {
        const rows = entries().map(entry => h("div", { class: "planner-row" }, item(entry),
          h("button", { class: "btn sm", "aria-label": complete + " · " + entry.text, onclick: () => {
            save(entries().filter(other => other.id !== entry.id)); input.focus();
          } }, complete)));
        list.replaceChildren(...(rows.length ? rows : [empty]));
      }
      function save(next) {
        if (AV.LS.set("agenda", next) === false) { AV.toast(AV.t("Não foi possível salvar.")); return false; }
        draw(); refresh(); return true;
      }
      const form = h("form", { class: "planner-form", onsubmit: event => {
        event.preventDefault();
        if (!input.value.trim()) { input.focus(); return; }
        if (save([...entries(), { id: AV.uid(), text: input.value.trim(), date: when.value }])) input.value = "";
        input.focus();
      } }, h("label", null, reminder, input), h("label", null, date, when), h("button", { class: "btn pri" }, add));
      draw();
      AV.dialog(agenda, h("div", { "data-notr": true }, form, list));
    }
    let timer;
    function schedule() {
      clearTimeout(timer);
      refresh();
      const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(schedule, midnight - Date.now() + 100);
    }
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return {
      element: h("div", { class: "side-cards planner", "data-notr": true },
        h("section", { class: "planner-card" }, h("div", { class: "planner-heading" }, AV.icon("calendar"), h("h2", null, agenda)), upcoming,
          h("button", { class: "btn sm", onclick: openPlanner }, manage)),
        h("section", { class: "planner-card planner-quote" }, h("div", { class: "planner-heading" }, AV.icon("sparkle"), h("h2", null, daily)), quote)),
      dispose() { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); }
    };
  };
})(window.AV);
