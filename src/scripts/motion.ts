// Анимации сайта: одна петля requestAnimationFrame, работает только пока значения меняются.
// on(read, fn): read() даёт цель 0..1 по раскладке, fn получает сглаженное значение (как scrub).
// При «уменьшить движение» сразу конечное состояние.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const vh = () => innerHeight;

type Sub = { read: () => number; fn: (v: number) => void; smooth: number; v: number | null; last?: number };
const subs: Sub[] = [];
const on = (read: () => number, fn: (v: number) => void, smooth = 0.12) =>
  subs.push({ read, fn, smooth, v: null });

let running = false;
const frame = () => {
  let moving = false;
  for (const s of subs) {
    const target = reduced ? 1 : clamp(s.read());
    s.v = s.v == null || reduced ? target : s.v + (target - s.v) * s.smooth;
    if (Math.abs(target - s.v) < 0.0005) s.v = target;
    else moving = true;
    if (s.v !== s.last) {
      s.last = s.v;
      s.fn(s.v);
    }
  }
  running = moving;
  if (moving) requestAnimationFrame(frame);
};
const kick = () => {
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
};
addEventListener('scroll', kick, { passive: true });
addEventListener('resize', kick);

// разбить текст элемента на слова, не трогая вложенную разметку (акценты, em).
// делим только по обычным пробелам: неразрывный пробел склеивает предлог со словом
function splitWords(el: Element, cls: string, inner = true): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const t of nodes) {
    const parts = (t.nodeValue || '').split(/([ \t\r\n]+)/);
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (!p) continue;
      if (/^[ \t\r\n]+$/.test(p)) {
        frag.append(' ');
        continue;
      }
      const w = document.createElement('span');
      w.className = cls;
      if (inner) {
        const i = document.createElement('i');
        i.textContent = p;
        w.append(i);
      } else w.textContent = p;
      frag.append(w);
      out.push(w);
    }
    t.replaceWith(frag);
  }
  return out;
}

// ---------- шапка: полная строка наверху, плавающая «таблетка» после прокрутки
const hdr = document.querySelector('.hdr');
if (hdr) {
  const upd = () => hdr.classList.toggle('is-float', scrollY > 40);
  addEventListener('scroll', upd, { passive: true });
  upd();
}

// ---------- hero: слова заголовка по очереди фокусируются (анимация по времени, CSS)
for (const h of document.querySelectorAll('[data-focus]')) {
  splitWords(h, 'w').forEach((w, i) => w.style.setProperty('--i', String(i)));
  h.classList.add('is-split');
}

// ---------- манифест: слова «загораются» по мере прокрутки
for (const scene of document.querySelectorAll<HTMLElement>('[data-lit-scene]')) {
  const copy = scene.querySelector<HTMLElement>('[data-lit-copy]');
  if (!copy) continue;
  const words = [...scene.querySelectorAll('[data-lit]')].flatMap((el) => splitWords(el, 'lw', false));
  const n = words.length;
  const band = 6; // сколько слов одновременно в процессе проявления
  const sticky = () => getComputedStyle(scene).getPropertyValue('--sticky').trim() === '1';
  on(
    () => {
      if (sticky()) {
        const r = scene.getBoundingClientRect();
        return (-r.top / (r.height - vh()) - 0.04) / 0.72;
      }
      const r = copy.getBoundingClientRect();
      return (vh() * 0.85 - r.top) / (r.height + vh() * 0.25);
    },
    (p) => {
      words.forEach((w, i) => w.style.setProperty('--lp', clamp((p * (n + band) - i) / band).toFixed(3)));
      scene.style.setProperty('--mp', p.toFixed(4));
    },
    0.16
  );
}

// ---------- финал: слова фокусируются, снизу поднимается тёплое свечение
const ft = document.querySelector<HTMLElement>('.sun-ft');
if (ft) {
  const scene = ft.querySelector<HTMLElement>('.sun-scene')!;
  const h = ft.querySelector<HTMLElement>('[data-words]')!;
  h.innerHTML = h.innerHTML
    .split(/<br[^>]*>/i)
    .map((line, k) =>
      line
        .trim()
        .split(/[ \t\r\n]+/)
        .map((w) => `<span class="w${k ? ' l2' : ''}"><i>${w}</i></span>`)
        .join(' ')
    )
    .join('<br>');
  const words = [...h.querySelectorAll<HTMLElement>('.w i')];

  // слова проявляются по очереди, пока сцена въезжает снизу
  on(
    () => (vh() - scene.getBoundingClientRect().top) / vh(),
    (q) => words.forEach((w, i) => w.style.setProperty('--wp', clamp((q - 0.1 - i * 0.05) / 0.35).toFixed(4)))
  );

  // слой свечения заходит под блок перед финалом и под футер: их высоты
  const prev = ft.previousElementSibling as HTMLElement | null;
  const foot = document.querySelector<HTMLElement>('footer');
  const size = () => {
    scene.style.setProperty('--up', String(prev?.offsetHeight ?? 0));
    scene.style.setProperty('--down', String(foot?.offsetHeight ?? 0));
  };
  size();
  addEventListener('resize', size);
  addEventListener('load', size);

  // сфера стартует, как только сцена показалась снизу, разрастается и заливает экран до того, как блок отлипнет
  on(
    () => {
      const r = scene.getBoundingClientRect();
      return (-r.top + 0.8 * vh()) / ((r.height - vh()) * 0.85 + 0.8 * vh());
    },
    (p) => {
      const rise = 1 - (1 - p) * (1 - p); // подъём: быстро сразу
      const grow = p * p * p * (p * (6 * p - 15) + 10); // рост: медленно, потом быстро
      scene.style.setProperty('--sb', rise.toFixed(4));
      scene.style.setProperty('--sg', grow.toFixed(4));
      scene.style.setProperty('--fill', clamp((p - 0.78) / 0.2).toFixed(4)); // в конце экран целиком в цвет сферы
    }
  );
}

kick();
