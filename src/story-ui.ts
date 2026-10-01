import type { Campaign } from './campaign.ts';
import type { Sound } from './audio.ts';
import { MISSIONS, stageVersions } from './campaign-content.ts';
import { chapterFor, evidence, sceneUnlocked, STORY, STORY_KEY, StoryState, type StoryScene } from './story.ts';
import './story.css';

const room = `<svg viewBox="0 0 560 440" role="img" aria-label="修表铺的工作台：两只杯子，一枚怀表，台灯下摊着调查材料。窗外是夜间的城市。">
  <defs><linearGradient id="room-sky" x2="0" y2="1"><stop stop-color="#192b31"/><stop offset="1" stop-color="#637668"/></linearGradient><radialGradient id="room-glow"><stop stop-color="#eee2a2" stop-opacity=".35"/><stop offset="1" stop-color="#eee2a2" stop-opacity="0"/></radialGradient></defs>
  <path fill="#283a37" d="M0 0h560v440H0z"/><path fill="url(#room-sky)" d="M34 28h300v236H34z"/>
  <g fill="#243c3c"><path d="M35 185h52v80H35zM94 119h68v146H94zM169 161h68v104h-68zM244 83h75v183h-75z"/></g>
  <g class="room-windows" fill="#c0c39b"><path d="M106 135h8v15h-8zM139 169h8v15h-8zM184 177h8v15h-8zM264 105h8v15h-8zM286 144h8v15h-8zM54 202h8v15h-8z"/></g>
  <path d="M34 28h300v236H34zM183 29v234M35 157h298" fill="none" stroke="#708576" stroke-width="8"/>
  <g stroke="#b0c4b2" opacity=".18"><path d="m74 50-9 36m63-19-8 34m99-37-12 55m71-80-10 40m-68 105-10 40m-80-8-10 35m176-70-10 30"/></g>
  <path d="M359 55h166v183H359z" fill="#415048" stroke="#88947a" stroke-width="3"/>
  <g class="room-evidence" fill="#cac7a7"><path d="m375 74 61 4-5 48-59-7zM451 96l52-5 4 65-52 4zM379 152l60-4 5 61-64-3z"/></g>
  <path d="m401 108 76 20-72 48" fill="none" stroke="#c18c65" stroke-width="2"/>
  <ellipse cx="363" cy="317" rx="225" ry="156" fill="url(#room-glow)"/>
  <path d="M0 323 490 283l70 95v62H0Z" fill="#6b7158"/><path d="M0 344 503 303M0 390l532-54M41 440l510-66" stroke="#b2ac82" opacity=".2"/>
  <path d="M393 317h95l-9-12h-77zM444 307l-37-105 44-81" fill="none" stroke="#182d2a" stroke-width="8"/>
  <path d="m415 145 60-11 33 51-106 21Z" fill="#bbbc85"/><path d="m403 205 105-20" stroke="#f1e4aa" stroke-width="4"/>
  <g class="room-file"><path d="m187 326 105-21 73 58-115 22z" fill="#d6d1ae"/><path d="m223 330 63-12m-51 22 64-12m-49 23 64-11" stroke="#7b856b" stroke-width="3"/></g>
  <g class="room-cups" fill="#bdc9aa" stroke="#263d32" stroke-width="3"><path d="M64 315h44l-5 43H70zM110 324c29-10 29 29-3 20"/><path class="second-cup" d="m145 280 38 1 5 36-48-1z"/></g>
  <g class="room-watch"><path d="M299 371q-6-22 36-28t33-34" stroke="#b4a671" fill="none" stroke-width="2"/><circle cx="283" cy="380" r="22" fill="#c2ae72"/><circle cx="283" cy="380" r="16" fill="#293e36"/><path d="M283 367v14l10 4" stroke="#e0d5ab" stroke-width="2"/></g>
  <path d="m29 396 101-7 10 51H23z" fill="#1c322d"/><path d="M57 394v-16h37v15" fill="none" stroke="#74846e" stroke-width="6"/>
  <g class="room-ticket"><path d="m175 406 58-9 4 19-58 10z" fill="#b9ae7f"/><path d="m194 404 3 18m12-21 2 8m6-9 2 8m6-9 2 8" stroke="#53614d" stroke-width="2"/></g>
  <g class="room-radio"><path d="M387 370h102v50H387z" fill="#2d4237" stroke="#b2b792" stroke-width="2"/><circle cx="409" cy="395" r="14" fill="#738268"/><path d="M434 383h42v8h-42z" fill="#c0cda1"/><path d="M395 370l-21-37m63 67h37m-37 6h37" stroke="#9caa83" stroke-width="2"/></g>
</svg>`;

export class StoryUI {
  readonly state: StoryState;
  private dialog: HTMLDialogElement;
  private scene?: StoryScene;
  private page = 0;
  private choice?: string;
  private replay = false;
  private fromJournal = false;
  private journalChapter = 0;
  private previousFocus: HTMLElement | null = null;
  private saved = true;
  constructor(private campaign: Campaign, private onOpen: () => void, private onClose: () => void, private sound: Sound) {
    let raw: unknown;
    try { raw = JSON.parse(localStorage.getItem(STORY_KEY) ?? 'null'); } catch { /* New journal. */ }
    this.state = new StoryState(raw);
    document.querySelector('.campaign-toolbar')!.insertAdjacentHTML('beforeend', '<button id="story-button">修表铺 · 故事与线索</button>');
    document.body.insertAdjacentHTML('beforeend', `<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title">
      <div class="story-art">${room}<div class="room-caption"><span>THE WATCHMAKER'S ROOM</span><strong id="story-place"></strong></div></div>
      <div class="story-content"><div class="story-tools"><span id="story-mode"></span><button id="story-sound"></button><button id="story-close" aria-label="收起故事，回到行动">收起 ×</button></div>
      <h2 id="story-title" tabindex="-1"></h2><div id="story-body"></div><div id="story-actions"></div><p id="story-save" role="status"></p></div>
    </dialog>`);
    this.dialog = document.querySelector('#story-dialog')!;
    document.querySelector('#story-button')!.addEventListener('click', () => { this.sound.unlock(); this.journal(); });
    this.el('#story-close').addEventListener('click', () => this.dialog.close());
    this.el('#story-sound').addEventListener('click', () => { this.sound.enabled = !this.sound.enabled; this.renderSound(); });
    // Returning readers already opted in, but browsers still need a new
    // gesture after reload. Advancing or opening the journal supplies it.
    this.dialog.addEventListener('click', () => this.sound.unlock());
    this.dialog.addEventListener('close', () => {
      this.scene = undefined;
      this.onClose();
      if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    });
    this.el('#story-actions').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.answer && this.scene && !this.replay) { this.choice = button.dataset.answer; this.remember(); this.renderScene(); }
      else if (button.id === 'story-next' && this.scene) {
        if (this.page < this.scene.pages.length - 1) { this.page++; this.remember(); this.renderScene(); }
        else if (!this.scene.choice || this.choice || this.replay) this.finish(false);
      } else if (button.id === 'story-back' && this.page > 0) { this.page--; this.remember(); this.renderScene(); }
      else if (button.id === 'story-skip') this.finish(true);
    });
    this.el('#story-body').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (button?.dataset.scene) {
        const scene = STORY.find(s => s.id === button.dataset.scene)!;
        if (sceneUnlocked(scene, this.campaign)) this.read(scene, true);
      } else if (button?.dataset.chapter) { this.journalChapter = Number(button.dataset.chapter); this.renderJournal(); }
    });
  }
  private el<T extends HTMLElement = HTMLElement>(selector: string) { return this.dialog.querySelector<T>(selector)!; }
  get open() { return this.dialog.open; }
  get theme() { return ['archive', 'gala', 'archive', 'industrial', 'clockwork', 'audit', 'audit', 'audit'][this.scene?.chapter ?? 0] as 'archive' | 'gala' | 'industrial' | 'clockwork' | 'audit'; }
  arrive() { const pending = this.state.pending(this.campaign); if (pending) this.read(pending); }
  aftermath() {
    const scene = STORY.find(s => s.moment === 'after' && s.mission === this.campaign.mission.id && sceneUnlocked(s, this.campaign) && !this.state.data.seen.includes(s.id));
    if (scene) this.read(scene);
  }
  private show() {
    if (!this.open) {
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.onOpen(); this.dialog.showModal();
    }
    this.renderSound();
    this.focusTitle();
  }
  private focusTitle() { this.el('#story-title').focus({ preventScroll: true }); this.dialog.scrollTop = 0; this.el('.story-content').scrollTop = 0; }
  private renderSound() { this.el('#story-sound').textContent = this.sound.enabled ? '声音：开' : '声音：关'; }
  private save() {
    try { localStorage.setItem(STORY_KEY, JSON.stringify(this.state.data)); this.saved = true; }
    catch { this.saved = false; }
    this.el('#story-save').textContent = this.saved ? '阅读进度保存在本机 · 随时收起，计时暂停' : '浏览器无法保存；本次阅读仍可继续';
  }
  private remember() {
    if (this.scene && !this.replay) {
      this.state.data.cursor = { id: this.scene.id, page: this.page, ...(this.choice ? { choice: this.choice } : {}) };
      this.save();
    }
  }
  private read(scene: StoryScene, fromJournal = false) {
    this.scene = scene; this.fromJournal = fromJournal;
    this.replay = this.state.data.seen.includes(scene.id);
    const cursor = this.state.data.cursor?.id === scene.id ? this.state.data.cursor : undefined;
    this.page = this.replay ? 0 : cursor?.page ?? 0;
    this.choice = this.replay ? this.state.data.choices[scene.id] : cursor?.choice;
    this.remember(); this.renderScene(); this.show();
  }
  private renderScene() {
    const scene = this.scene!, last = this.page === scene.pages.length - 1, line = scene.pages[this.page];
    this.dialog.dataset.prop = scene.prop;
    this.dialog.dataset.chapter = String(scene.chapter);
    this.dialog.dataset.scene = scene.id;
    this.dialog.dataset.cups = String(!this.campaign.data.completed.includes('C0-6') || this.campaign.data.completed.includes('C6-2'));
    this.dialog.classList.remove('journal-open');
    this.el('#story-mode').textContent = `${this.replay ? '回看' : '幕间'} / C${scene.chapter} · ${this.page + 1} / ${scene.pages.length}`;
    this.el('#story-place').textContent = scene.place;
    this.el('#story-title').textContent = scene.title;
    const speaker = document.createElement('p'); speaker.className = 'story-speaker'; speaker.textContent = line.speaker;
    const paragraph = document.createElement('p'); paragraph.className = 'story-prose'; paragraph.textContent = this.state.text(line);
    this.el('#story-body').replaceChildren(speaker, paragraph);
    if (last && scene.choice) {
      const prompt = document.createElement('p'); prompt.className = 'story-question'; prompt.textContent = scene.choice.prompt;
      this.el('#story-body').append(prompt);
      if (this.choice) {
        const reply = document.createElement('p'); reply.className = 'story-reply'; reply.textContent = scene.choice.options.find(o => o.id === this.choice)!.reply;
        this.el('#story-body').append(reply);
      } else if (this.replay) {
        const absent = document.createElement('p'); absent.textContent = '这段对话曾被跳过，你没有留下回答。'; this.el('#story-body').append(absent);
      }
    }
    this.el('#story-actions').innerHTML = `${last && scene.choice ? `<div class="story-answers">${scene.choice.options.map(o => `<button data-answer="${o.id}" aria-pressed="${this.choice === o.id}" ${this.replay ? 'disabled' : ''}>${o.label}</button>`).join('')}</div>` : ''}
      <div class="story-navigation"><button id="story-back" ${this.page === 0 ? 'disabled' : ''}>上一页</button><button id="story-next" class="primary-button" ${last && scene.choice && !this.choice && !this.replay ? 'disabled' : ''}>${last ? this.fromJournal ? '回到修表铺' : '继续行动' : '继续阅读 →'}</button>${!this.replay ? '<button id="story-skip" class="story-skip">跳过本段</button>' : ''}</div>`;
    if (this.replay) this.el('#story-save').textContent = '回看不会改写已经留下的回答';
    this.focusTitle();
  }
  private finish(skip: boolean) {
    if (!this.scene) return;
    if (!this.replay) { this.state.finish(this.scene, skip ? undefined : this.choice); this.save(); }
    if (this.fromJournal) this.journal(); else this.dialog.close();
  }
  private journal() {
    this.scene = undefined;
    this.journalChapter = Number(chapterFor(this.campaign.mission.id) ?? 0);
    this.renderJournal(); this.show();
  }
  private renderJournal() {
    const collected = evidence(this.campaign), chapters = [...new Set(STORY.filter(s => sceneUnlocked(s, this.campaign)).map(s => s.chapter))];
    if (!chapters.includes(this.journalChapter)) this.journalChapter = chapters.at(-1) ?? 0;
    const scenes = STORY.filter(s => s.chapter === this.journalChapter && sceneUnlocked(s, this.campaign));
    const items = collected.filter(m => Number(chapterFor(m.id)) === this.journalChapter);
    const contact = collected.some(m => m.id === 'C6-2'), confession = collected.some(m => m.id === 'C5-6');
    const endings = MISSIONS.flatMap(m => m.stages.flatMap(stageVersions)).flatMap(s => s.ending && this.campaign.data.endings?.includes(s.ending.id) ? [s.ending] : []);
    this.dialog.classList.add('journal-open'); this.dialog.dataset.chapter = String(this.journalChapter); this.dialog.dataset.prop = 'file';
    this.dialog.dataset.cups = String(!this.campaign.data.completed.includes('C0-6') || contact);
    delete this.dialog.dataset.scene;
    this.el('#story-mode').textContent = `安全屋 / ${collected.length} 份线索`;
    this.el('#story-place').textContent = contact ? '修表铺 · 两只杯子都留着' : '修表铺 · 留一盏灯';
    this.el('#story-title').textContent = '桌上的事，还没有完';
    this.el('#story-body').innerHTML = `<p class="journal-intro">${endings.length ? '身份与罪证都已登记。你把最后的回执夹进文件，关好店门，去见旧渡口的人。两只杯子留在工作台上，等下次一起回来。' : contact ? '旧渡口的地址压在怀表下面。你已经听到了搭档的声音，接下来要让他的身份重新被承认。' : confession ? '批准书上多了一个熟悉的签名。电话仍然接通，但墙上的证据得由彼此独立的记录来证实。' : '空椅子还在对面。把带回来的线索摆在一起，再想一想下一扇门通向哪里。'}</p>
      <nav class="journal-tabs" aria-label="回顾章节">${chapters.map(c => `<button data-chapter="${c}" aria-current="${c === this.journalChapter ? 'page' : 'false'}">C${c} ${MISSIONS.find(m => m.id === `C${c}-1`)!.chapter}</button>`).join('')}</nav>
      <h3>那时说过的话</h3><div class="journal-scenes">${scenes.map(s => `<button data-scene="${s.id}"><span>${s.title}</span><small>${this.state.data.cursor?.id === s.id ? '继续阅读' : this.state.data.seen.includes(s.id) ? '回看' : '未读'}</small></button>`).join('')}</div>
      <h3>带回来的证据</h3><ol class="journal-evidence">${items.map(m => `<li><strong>${m.evidence}</strong><span>${m.title}</span></li>`).join('') || '<li>这章还没有带回线索。</li>'}</ol>
      ${endings.length ? `<h3>已经抵达的后来</h3><ul class="journal-evidence">${endings.map(e => `<li><strong>${e.title}</strong>${e.consequence}</li>`).join('')}</ul>` : ''}
      <details class="journal-rules"><summary>手腕上的回声，与档案里的记忆</summary><p>回声是你录下的动作，能重演值守和操作，不能替人思考，也不会复制实体物件。${collected.some(m => m.id === 'C1-3') ? '被交易的记忆是私人档案片段。' : ''}${contact ? '身份抹除删掉的是公共登记中的姓名和来源索引；恢复身份不等于补回一个人失去的生活。' : ''}</p></details>`;
    this.el('#story-actions').replaceChildren();
    this.el('#story-save').textContent = this.saved ? '只展示已经抵达的章节与取得的证据' : '浏览器无法保存；本次阅读仍可继续';
    this.focusTitle();
  }
}
