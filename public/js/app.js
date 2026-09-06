import "./config.js";
import { supabase } from "./supabase.js";
import { api } from "./api.js";

window.SENNIN_SUPABASE = supabase;

const app = document.querySelector("#app");
let currentView = "home";
let installed = JSON.parse(localStorage.getItem("sennin-installed-apps") || "[]");
let currentProject = null;
let currentFiles = [];
let currentFile = null;

const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));

async function session() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function layout(content) {
  app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">◈ Sennin Network</div>
      <div class="nav">
        ${nav("home","ホーム")}
        ${nav("store","App Store")}
        ${nav("dev","DevStudio")}
        ${nav("explorer","エクスプローラー")}
        ${nav("overview","概要")}
        ${nav("account","アカウント")}
        ${nav("security","セキュリティ")}
      </div>
      <div style="margin-top:20px"><button class="btn secondary" id="logout">ログアウト</button></div>
    </aside>
    <main class="main">${content}</main>
  </div>`;
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => render(b.dataset.view));
  document.querySelector("#logout").onclick = async () => { await supabase.auth.signOut(); render(); };
}

function nav(id,label){ return `<button data-view="${id}" class="${currentView===id?"active":""}">${label}</button>`; }

async function render(view = "home") {
  currentView = view;
  const s = await session();
  if (!s) return renderAuth();
  if (view === "home") return home();
  if (view === "store") return store();
  if (view === "dev") return dev();
  if (view === "explorer") return explorer();
  if (view === "overview") return overview();
  if (view === "account") return account();
  if (view === "security") return security();
}

function renderAuth(message="") {
  app.innerHTML = `<div class="auth"><div class="card">
    <h1>Sennin Network OS</h1>
    <p class="muted">Webアプリをインストールして使えるプラットフォーム</p>
    ${message ? `<div class="notice">${esc(message)}</div>` : ""}
    <div class="form">
      <label>メール<input id="email" type="email" autocomplete="email"></label>
      <label>パスワード<input id="password" type="password" autocomplete="current-password"></label>
      <div class="row"><button class="btn" id="login">ログイン</button><button class="btn secondary" id="signup">アカウント作成</button></div>
    </div>
  </div></div>`;
  document.querySelector("#login").onclick = () => auth(false);
  document.querySelector("#signup").onclick = () => auth(true);
}

async function auth(signup) {
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  if (!email || password.length < 8) return renderAuth("メールアドレスと8文字以上のパスワードを入力してください。");
  const result = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) return renderAuth(result.error.message);
  render();
}

async function home() {
  const apps = installed;
  layout(`<div class="topbar"><div><h1>ホーム</h1><p class="muted">インストール済みアプリ</p></div><button class="btn" id="open-store">App Store</button></div>
  <div class="grid">${apps.length ? apps.map(a => `<div class="card app-card"><div><div class="icon">${esc(a.icon||"◈")}</div><h3>${esc(a.name)}</h3><p class="muted">${esc(a.description||"")}</p></div><button class="btn" data-launch="${esc(a.slug)}">起動</button></div>`).join("") : `<div class="card"><h3>アプリがありません</h3><p class="muted">App Storeからアプリをインストールしてください。</p></div>`}</div>`);
  document.querySelector("#open-store").onclick=()=>render("store");
  document.querySelectorAll("[data-launch]").forEach(b=>b.onclick=()=>launch(b.dataset.launch));
}

async function store() {
  const { apps } = await api("/apps");
  layout(`<div class="topbar"><div><h1>App Store</h1><p class="muted">紹介情報・コメント・出品者を確認してからインストール</p></div></div><div class="grid">
  ${apps.length ? apps.map(a=>`<div class="card app-card">
    <div>
      <div class="icon">${esc(a.icon||"◈")}</div>
      <h3>${esc(a.name)}</h3>
      <p class="muted">${esc(a.description)}</p>
      <small class="muted">v${a.version} · ★ ${Number(a.rating||0).toFixed(1)} (${a.rating_count||0}) · ${a.downloads||0} downloads</small>
      <p><button class="btn secondary" data-details="${esc(a.slug)}">詳細・コメント・出品者</button></p>
    </div>
    <button class="btn" data-install="${esc(a.slug)}">${installed.some(x=>x.slug===a.slug)?"インストール済み":"インストール"}</button>
  </div>`).join("") : `<div class="card"><h3>公開アプリはまだありません</h3></div>`}
  </div>`);

  document.querySelectorAll("[data-details]").forEach(b=>b.onclick=()=>showStoreDetails(b.dataset.details));
  document.querySelectorAll("[data-install]").forEach(b=>b.onclick=()=>installFromStore(b.dataset.install));
}

async function showStoreDetails(slug) {
  const d = await api(`/apps/${slug}`);
  const seller = await api(`/sellers/${d.app.owner_id}`);
  layout(`<div class="topbar"><div><h1>${esc(d.app.name)}</h1><p class="muted">${esc(d.app.description)}</p></div><button class="btn secondary" id="back-store">App Storeへ戻る</button></div>
  <div class="grid">
    <div class="card">
      <div class="icon">${esc(d.app.icon||"◈")}</div>
      <h2>紹介情報</h2>
      <p>${esc(d.app.description)}</p>
      <p class="muted">バージョン ${d.app.version} / ★ ${Number(d.app.rating||0).toFixed(1)} / ${d.app.rating_count||0}件</p>
      <button class="btn" id="detail-install">インストール</button>
    </div>
    <div class="card">
      <h2>出品者</h2>
      <h3>${esc(seller.seller.display_name)}</h3>
      <p class="muted">${esc(seller.seller.bio||"")}</p>
      <p>${seller.seller.website ? `<a href="${esc(seller.seller.website)}" target="_blank" rel="noopener noreferrer">Webサイト</a>` : ""}</p>
      <h3>公開アプリ</h3>
      ${seller.apps.map(a=>`<div class="notice">${esc(a.name)} · ★ ${Number(a.rating||0).toFixed(1)}</div>`).join("")}
    </div>
    <div class="card">
      <h2>コメント</h2>
      ${d.reviews.length ? d.reviews.map(r=>`<div class="notice" style="margin-bottom:8px">★ ${r.rating}<br>${esc(r.comment)}</div>`).join("") : `<p class="muted">まだコメントはありません。</p>`}
      <label>評価<select id="review-rating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label>
      <label>コメント<textarea id="review-comment" maxlength="1000"></textarea></label>
      <button class="btn secondary" id="review-submit">コメントを投稿</button>
    </div>
  </div>`);
  document.querySelector("#back-store").onclick=()=>render("store");
  document.querySelector("#detail-install").onclick=()=>installFromStore(d.app.slug);
  document.querySelector("#review-submit").onclick=async()=>{
    await api(`/apps/${d.app.id}/reviews`,{method:"POST",body:JSON.stringify({rating:Number(document.querySelector("#review-rating").value),comment:document.querySelector("#review-comment").value})});
    showStoreDetails(slug);
  };
}

async function installFromStore(slug) {
  const d = await api(`/apps/${slug}`);
  const accepted = confirm(
    `「${d.app.name}」をインストールします。\n\n` +
    `このアプリはSennin Networkの審査・自動保護を通過していても、悪意のある動作や未知の脆弱性を完全に排除できることを保証するものではありません。\n\n` +
    `アプリの利用・インストール・データ損失・損害等について、Sennin Network運営側が責任を負わないことに同意します。\n\n` +
    `同意してインストールしますか？`
  );
  if (!accepted) return;
  await api(`/apps/${d.app.id}/install-consent`,{method:"POST",body:JSON.stringify({accepted:true})});
  const x={...d.app,files:d.files};
  installed=[...installed.filter(a=>a.slug!==x.slug),x];
  localStorage.setItem("sennin-installed-apps",JSON.stringify(installed));
  alert("インストールしました。");
  render("home");
}

async function launch(slug) {
  const local = installed.find(a=>a.slug===slug);
  const d = local?.files ? local : await api(`/apps/${slug}`);
  const htmlFile = d.files.find(f=>f.path==="index.html");
  if (!htmlFile) return alert("index.html がありません。");
  const css = d.files.filter(f=>f.path.endsWith(".css")).map(f=>`<style>${f.content}</style>`).join("");
  const js = d.files.filter(f=>f.path.endsWith(".js")).map(f=>`<script>${f.content.replace(/<\\/script/gi,"<\\\\/script")}<\\/script>`).join("");
  const source = htmlFile.content.replace(/<link[^>]+href=["'][^"']+\.css["'][^>]*>/gi,"").replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/gi,"").replace(/<\/head>/i,`${css}</head>`).replace(/<\/body>/i,`${js}</body>`);
  app.innerHTML=`<div class="topbar"><div><h1>${esc(d.app.name)}</h1><p class="muted">sandbox app runtime</p></div><button class="btn secondary" id="back">ホームへ戻る</button></div><iframe class="preview" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${esc(source).replace(/\n/g,"&#10;")}"></iframe>`;
  document.querySelector("#back").onclick=()=>render("home");
}

async function dev() {
  const { projects } = await api("/me/projects");
  layout(`<div class="topbar"><div><h1>DevStudio</h1><p class="muted">HTML / CSS / JavaScriptでアプリを開発</p></div><button class="btn" id="new-project">新規アプリ</button></div>
  <div class="grid">${projects.map(p=>`<div class="card app-card"><div><div class="icon">${esc(p.icon||"◈")}</div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.description)}</p></div><button class="btn secondary" data-project="${p.id}">開く</button></div>`).join("")}</div>`);
  document.querySelector("#new-project").onclick=()=>createProject();
  document.querySelectorAll("[data-project]").forEach(b=>b.onclick=()=>openProject(b.dataset.project));
}

async function createProject(){
  const name=prompt("アプリ名","My App"); if(!name) return;
  const d=await api("/me/projects",{method:"POST",body:JSON.stringify({name,description:"Sennin Network App",icon:"◈",files:[
    {path:"index.html",content:"<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>My App</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><h1>Hello Sennin Network</h1><script src=\"app.js\"></script></body></html>"},
    {path:"style.css",content:"body{font-family:system-ui;padding:40px;background:#f5f7fb;color:#111}"},
    {path:"app.js",content:"console.log('Sennin App');"}
  ]})});
  openProject(d.project.id);
}

async function openProject(id){
  const d=await api(`/me/projects/${id}`); currentProject=d.project; currentFiles=d.files; currentFile=currentFiles.find(f=>f.path==="index.html")||currentFiles[0]; devEditor();
}

function devEditor(){
  layout(`<div class="topbar"><div><h1>DevStudio / ${esc(currentProject.name)}</h1><p class="muted">変更は保存してから公開できます。</p></div><div class="row"><button class="btn secondary" id="save">保存</button><button class="btn" id="publish">App Storeへ公開</button></div></div>
  <div class="dev-layout"><div class="card files"><h3>Explorer</h3>${currentFiles.map(f=>`<div class="file ${currentFile.path===f.path?"selected":""}" data-file="${esc(f.path)}">${esc(f.path)}</div>`).join("")}</div>
  <div class="card"><label>${esc(currentFile.path)}<textarea id="editor" class="editor"></textarea></label></div>
  <div class="card"><h3>Preview</h3><iframe id="dev-preview" class="preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div></div>`);
  const editor=document.querySelector("#editor"); editor.value=currentFile.content; updatePreview();
  editor.oninput=()=>{currentFile.content=editor.value;updatePreview()};
  document.querySelectorAll("[data-file]").forEach(b=>b.onclick=()=>{currentFile=currentFiles.find(f=>f.path===b.dataset.file);devEditor()});
  document.querySelector("#save").onclick=saveProject;
  document.querySelector("#publish").onclick=publishProject;
}

function buildSource(){
  const html=currentFiles.find(f=>f.path==="index.html")?.content||"";
  const css=currentFiles.filter(f=>f.path.endsWith(".css")).map(f=>`<style>${f.content}</style>`).join("");
  const js=currentFiles.filter(f=>f.path.endsWith(".js")).map(f=>`<script>${f.content.replace(/<\\/script/gi,"<\\\\/script")}<\\/script>`).join("");
  return html.replace(/<link[^>]+href=["'][^"']+\.css["'][^>]*>/gi,"").replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/gi,"").replace(/<\/head>/i,`${css}</head>`).replace(/<\/body>/i,`${js}</body>`);
}

function updatePreview(){ document.querySelector("#dev-preview").srcdoc=buildSource(); }

async function saveProject(){
  await api(`/me/projects/${currentProject.id}`,{method:"PUT",body:JSON.stringify({...currentProject,files:currentFiles})});
  alert("保存しました");
}

async function publishProject(){
  await saveProject();
  const storeDescription = prompt("App Storeの紹介情報を入力してください", currentProject.description || "");
  if (storeDescription === null) return;
  const d=await api("/me/publish",{method:"POST",body:JSON.stringify({projectId:currentProject.id,storeDescription})});
  alert(`公開しました: ${d.app.slug}`);
}

async function explorer(){
  const {projects}=await api("/me/projects");
  layout(`<div class="topbar"><div><h1>エクスプローラー</h1><p class="muted">あなたのプロジェクトとファイル</p></div></div><div class="grid">${projects.map(p=>`<div class="card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.description)}</p><button class="btn secondary" data-open="${p.id}">DevStudioで開く</button></div>`).join("")}</div>`);
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openProject(b.dataset.open));
}

async function overview(){
  const {apps}=await api("/apps");
  layout(`<div class="topbar"><div><h1>概要</h1><p class="muted">Sennin Network OSの状態</p></div></div><div class="grid">
  <div class="card"><h2>${apps.length}</h2><p class="muted">公開アプリ</p></div>
  <div class="card"><h2>DevStudio</h2><p class="muted">HTML/CSS/JS開発環境</p></div>
  <div class="card"><h2>Supabase</h2><p class="muted">Auth / PostgreSQL / RLS</p></div>
  <div class="card"><h2>Sandbox</h2><p class="muted">アプリをsandbox iframeで実行</p></div></div>`);
}

async function account(){
  const s=await session();
  layout(`<div class="topbar"><div><h1>アカウント</h1><p class="muted">ログイン情報</p></div></div><div class="card form">
  <label>メール<input value="${esc(s.user.email||"")}" disabled></label>
  <label>User ID<input value="${esc(s.user.id)}" disabled></label>
  <div class="notice">認証はSupabase Authで管理されています。</div></div>`);
}

async function security(){
  layout(`<div class="topbar"><div><h1>セキュリティ</h1><p class="muted">Sennin Network OSの安全対策</p></div></div>
  <div class="grid">
  <div class="card"><h3>RLS</h3><p class="muted">ユーザーのプロジェクトは所有者単位で保護します。</p></div>
  <div class="card"><h3>Secret Key</h3><p class="muted">Supabase secret keyはサーバーだけで使用します。</p></div>
  <div class="card"><h3>Sandbox</h3><p class="muted">公開アプリをsandbox iframeで隔離して実行します。完全なマルウェア防御ではないため、公開アプリを本番で安全に提供する場合は専用オリジン分離も必要です。</p></div>
  <div class="card"><h3>Rate Limit</h3><p class="muted">APIへレート制限を適用しています。</p></div>
  <div class="card"><h3>CSP / Helmet</h3><p class="muted">HTTPセキュリティヘッダーとCSPを使用します。</p></div>
  <div class="card"><h3>MFA</h3><p class="muted">本番ではSupabase Authの多要素認証を有効化してください。</p></div>
  </div>`);
}

supabase.auth.onAuthStateChange(() => render(currentView));
render();
