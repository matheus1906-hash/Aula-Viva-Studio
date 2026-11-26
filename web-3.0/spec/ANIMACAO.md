# Estúdio de animação: contract for `src/animacao.js`

A teacher of young children (Educação Infantil to 5º ano) creates short **cartoon videos** from a
story JSON. The module draws everything procedurally on a `<canvas>` 2D context (no images, no
external assets, no libraries) in a cute, original, rounded flat-cartoon style: thick soft
outlines (#1F2937 at ~4px), bright friendly palette, big expressive eyes that blink, simple
smiles, rosy cheeks, gentle shadows under actors. Never imitate existing cartoon characters.

Follow spec/SPEC.md for the module format (plain script attaching to `globalThis.AV`).

## Story JSON

```js
story = {
  title: "O ciclo da água", lang: "pt-BR",
  scenes: [{
    bg: "sala" | "parque" | "espaco" | "fazenda" | "oceano" | "cidade" | "floresta" | "cerrado" | "ceu" | "lousa" | "casa" | "escola",
    duration: 6,                      // seconds, 2..20
    narration: "A gotinha Gigi mora no rio.",   // read aloud by the app (TTS) and drawn as subtitle when captions on
    actors: [{
      type: "menina" | "menino" | "professora" | "professor" | "vovo" | "gato" | "cachorro" | "passaro" | "coelho" | "tartaruga" |
            "peixe" | "abelha" | "borboleta" | "sol" | "lua" | "nuvem" | "chuva" | "arvore" | "flor" | "planeta" | "estrela" |
            "gota" | "foguete" | "livro" | "lapis" | "maca" | "casa" | "letra" | "numero" | "forma",
      x: 0.5, y: 0.75,                // anchor at the actor's feet/bottom-center, fraction of canvas
      scale: 1,                       // 0.3..3 (1 ≈ 22% of canvas height for people)
      color: "#F59E0B",               // optional main color (shirt, body, planet...)
      text: "A",                      // letra/numero: the glyph; forma: "circulo"|"quadrado"|"triangulo"|"estrela"|"coracao"
      anim: "parado" | "entrar-esquerda" | "entrar-direita" | "sair-direita" | "pular" | "balancar" | "andar" | "girar" |
            "aparecer" | "crescer" | "flutuar" | "falar" | "acenar" | "chover",
      say: "Oi, turma!",              // optional speech bubble shown while anim runs
      delay: 0,                       // seconds after scene start
      flip: false                     // face left
    }],
    texts: [{ text: "Evaporação", x: 0.5, y: 0.15, size: 1, anim: "aparecer" | "pular" | "digitar", color: "#fff" }]
  }]
}
```

## API (all on `AV.anim`)

- `BACKGROUNDS` `{id: "Sala de aula", ...}`, `ACTORS` `{id: "Menina", ...}`, `ANIMS` `{id: "Pular", ...}` (Portuguese labels, used by the UI).
- `validate(story) -> story`: returns a sanitized deep copy (unknown types dropped, numbers clamped, strings capped at 300 chars, max 30 scenes, max 8 actors and 4 texts per scene). Never throws.
- `duration(story) -> seconds`.
- `drawFrame(ctx, story, t, opts)`: pure render of the whole frame at absolute time `t` seconds (picks the scene, eases animations, crossfades 0.4 s between scenes). `opts = {captions: true, width, height}`. Captions: rounded dark bar at the bottom with white text, wrapped to 2 lines.
- `new AV.anim.Player(canvas, story, {captions, onScene(i, scene), onEnd(), onTime(t)})` with `play()`, `pause()`, `toggle()`, `seek(seconds)`, `seekScene(i)`, `playing` (bool), `time`, `destroy()`. Uses `requestAnimationFrame`; pauses automatically when the tab is hidden; resizes drawing to the canvas size (keep 16:9, default 1280×720 internal resolution, scale with devicePixelRatio up to 2).
- `exportWebM(story, {captions: true, fps: 30, onProgress(fraction)}) -> Promise<Blob>`: renders in real time into an offscreen canvas with `canvas.captureStream(fps)` + `MediaRecorder` (prefer `video/webm;codecs=vp9`, fall back to vp8/`video/webm`). Reject with an Error with a Portuguese message if MediaRecorder is missing.
- `thumbnail(story, sceneIndex, w=320) -> dataURL` (frame at the middle of the scene).
- `TEMPLATES`: array of 12 ready stories in Portuguese for children, each `{id, title, level, subject, description, story}`, 5 to 9 scenes, varied backgrounds and actors, correct content: ciclo da água; as vogais; contando de 1 a 10; o sistema solar; lavar as mãos; as estações do ano; os animais da fazenda; as formas geométricas; respeito às diferenças (amizade); plantando uma semente; o Cerrado e seus animais; o alfabeto (A a E com palavras).

## Quality bar

- Every actor type and background must be drawn and look polished at 1280×720 and at 320 px thumbnails.
- People: varied skin tones (choose deterministically from the actor index or `color`), hair styles, clothes in `color`.
- Idle life: subtle breathing/bob for all actors, blinking every 3–5 s, mouth moving while `falar` or while `say` is visible.
- Speech bubbles: white rounded bubble with tail toward the actor, auto-wrapped, never off-canvas.
- Performance: draw a 1280×720 frame in well under 8 ms on a laptop; cache static background layers in an offscreen canvas per scene.
- Deterministic: same story and `t` produce the same frame (use a seeded PRNG for decorations like stars/grass).
