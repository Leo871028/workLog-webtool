const baseGetFilteredTasks=getFilteredTasks;
const baseRenderDashboard=renderDashboard;
const baseRenderTasks=renderTasks;

getFilteredTasks=function(){
  return baseGetFilteredTasks().filter(t=>!t.archived);
};

renderDashboard=function(){
  if(typeof dashboardTotal==="undefined")return;
  const activeTasks=tasks.filter(t=>!t.archived);
  const open=activeTasks.filter(t=>t.status!=="Done");
  const overdue=open.filter(t=>t.deadline&&deadlineDaysLeft(t.deadline)<0);
  const dueSoon=open.filter(t=>{const d=t.deadline?deadlineDaysLeft(t.deadline):null;return d!==null&&d>=0&&d<=3});
  const ongoing=activeTasks.filter(t=>t.status==="Ongoing");
  dashboardTotal.textContent=open.length;
  dashboardOngoing.textContent=ongoing.length;
  dashboardOverdue.textContent=overdue.length;
  dashboardDueSoon.textContent=dueSoon.length;
  const upcoming=open.filter(t=>t.deadline&&deadlineDaysLeft(t.deadline)!==null).sort((a,b)=>taskDeadlineSortValue(a)-taskDeadlineSortValue(b)).slice(0,5);
  upcomingDeadlines.innerHTML=upcoming.length?upcoming.map(t=>{const d=deadlineDaysLeft(t.deadline),state=d<0?"overdue":d<=3?"due-soon":"";return`<div class="upcoming-item"><div><strong>${esc(t.title)}</strong><span>${esc(t.status)} · ${esc(t.priority)}</span></div><span class="upcoming-date ${state}">${deadlineText(t)}</span></div>`}).join(""):`<div class="dashboard-empty">No upcoming deadlines.</div>`;
};

function archivedTasks(){return tasks.filter(t=>Boolean(t.archived))}
function updateArchivedCount(){if(typeof archivedTasksBtn!=="undefined")archivedTasksBtn.textContent=`Archived Tasks (${archivedTasks().length})`}

async function archiveTask(id){
  const t=tasks.find(x=>String(x.id)===String(id));
  if(!t||t.status!=="Done")return;
  const{error}=await db.from("tasks").update({archived:true,archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
  if(error)return alert(`Archive failed: ${error.message}`);
  await loadTasks();
  if(!archiveModal.classList.contains("hidden"))renderArchivedTasks();
  toast("Task archived.");
}

async function restoreArchivedTask(id){
  const{error}=await db.from("tasks").update({archived:false,archived_at:null,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)return alert(`Restore failed: ${error.message}`);
  await loadTasks();
  renderArchivedTasks();
  toast("Task restored to Done.");
}

function archivedTaskCard(t){
  const archivedDate=t.archived_at?String(t.archived_at).slice(0,10):"";
  const deadline=t.deadline?`<span>Deadline · ${esc(t.deadline)}</span>`:"";
  const desc=t.description?`<p>${esc(t.description)}</p>`:"";
  return `<article class="archive-item"><div class="archive-item-head"><div><strong>${esc(t.title)}</strong><span>${esc(t.priority)} · ${esc(t.status)}${archivedDate?` · Archived ${esc(archivedDate)}`:""}</span>${deadline}</div></div>${desc}<div class="archive-item-actions"><button class="btn success" data-archive-restore="${t.id}">Restore</button><button class="btn primary" data-archive-edit="${t.id}">Edit</button><button class="btn danger" data-archive-delete="${t.id}">Delete</button></div></article>`;
}

function renderArchivedTasks(){
  if(typeof archivedTaskList==="undefined")return;
  const q=(archivedTaskSearch.value||"").trim().toLowerCase();
  const list=archivedTasks().filter(t=>!q||`${t.title||""} ${t.description||""}`.toLowerCase().includes(q)).sort((a,b)=>String(b.archived_at||b.updated_at||"").localeCompare(String(a.archived_at||a.updated_at||"")));
  archivedTaskList.innerHTML=list.length?list.map(archivedTaskCard).join(""):`<div class="archive-empty">No archived tasks found.</div>`;
  document.querySelectorAll("[data-archive-restore]").forEach(b=>b.onclick=()=>restoreArchivedTask(b.dataset.archiveRestore));
  document.querySelectorAll("[data-archive-edit]").forEach(b=>b.onclick=()=>openEditTask(b.dataset.archiveEdit));
  document.querySelectorAll("[data-archive-delete]").forEach(b=>b.onclick=async()=>{await deleteTask(b.dataset.archiveDelete);renderArchivedTasks()});
}

function openArchiveModal(){renderArchivedTasks();archiveModal.classList.remove("hidden");archivedTaskSearch.focus()}
function closeArchiveModal(){archiveModal.classList.add("hidden")}

renderTasks=function(){
  baseRenderTasks();
  updateArchivedCount();
  document.querySelectorAll("#doneList .task-card").forEach(card=>{
    const edit=card.querySelector("[data-edit]");
    if(!edit)return;
    const t=tasks.find(x=>String(x.id)===String(edit.dataset.edit));
    if(!t||t.archived||t.status!=="Done"||card.querySelector("[data-archive]"))return;
    const btn=document.createElement("button");
    btn.className="btn secondary";
    btn.type="button";
    btn.dataset.archive=t.id;
    btn.textContent="Archive";
    btn.onclick=()=>archiveTask(t.id);
    card.querySelector(".task-actions")?.insertBefore(btn,edit);
  });
};

if(typeof archivedTasksBtn!=="undefined")archivedTasksBtn.onclick=openArchiveModal;
if(typeof closeArchiveModalBtn!=="undefined")closeArchiveModalBtn.onclick=closeArchiveModal;
if(typeof archivedTaskSearch!=="undefined")archivedTaskSearch.addEventListener("input",renderArchivedTasks);
if(typeof archiveModal!=="undefined")archiveModal.addEventListener("click",e=>{if(e.target===archiveModal)closeArchiveModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&typeof archiveModal!=="undefined"&&!archiveModal.classList.contains("hidden"))closeArchiveModal()});

renderTasks();
