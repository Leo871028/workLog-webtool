function pinTaskSort(a,b){
  const ap=Boolean(a.pinned),bp=Boolean(b.pinned);
  if(ap!==bp)return ap?-1:1;
  if(ap&&bp){
    const at=String(a.pinned_at||""),bt=String(b.pinned_at||"");
    const pinnedOrder=bt.localeCompare(at);
    if(pinnedOrder)return pinnedOrder;
  }
  return 0;
}

async function logPinActivity(task,isPinned){
  if(!currentUser)return;
  try{
    await db.from("task_activity").insert({
      user_id:currentUser.id,
      task_id:task.id,
      task_title:task.title||"",
      event_type:isPinned?"pinned":"unpinned",
      old_value:isPinned?"not pinned":"pinned",
      new_value:isPinned?"pinned":"not pinned",
      details:{}
    });
  }catch(_){/* Activity History is optional until its migration is installed. */}
}

async function toggleTaskPin(id){
  const task=tasks.find(t=>String(t.id)===String(id));
  if(!task||task.archived)return;
  const next=!Boolean(task.pinned);
  const payload={
    pinned:next,
    pinned_at:next?new Date().toISOString():null,
    updated_at:new Date().toISOString()
  };
  const{error}=await db.from("tasks").update(payload).eq("id",id);
  if(error)return alert(`Pin failed: ${error.message}`);
  await logPinActivity(task,next);
  await loadTasks();
  if(typeof loadActivityHistory==="function"&&document.getElementById("activity-history")?.classList.contains("active"))loadActivityHistory();
  toast(next?"Task pinned.":"Task unpinned.");
}

function decoratePinnedCards(){
  [todoList,ongoingList,doneList].forEach(list=>{
    if(!list)return;
    const cards=[...list.querySelectorAll(".task-card")];
    cards.forEach(card=>{
      const edit=card.querySelector("[data-edit]");
      if(!edit)return;
      const task=tasks.find(t=>String(t.id)===String(edit.dataset.edit));
      if(!task||task.archived)return;
      card.classList.toggle("task-pinned",Boolean(task.pinned));
      const title=card.querySelector(".task-title");
      if(title&&task.pinned&&!title.querySelector(".pin-mark")){
        const mark=document.createElement("span");
        mark.className="pin-mark";
        mark.textContent="📌";
        mark.title="Pinned task";
        title.prepend(mark);
      }
      const actions=card.querySelector(".task-actions");
      if(actions&&!actions.querySelector("[data-pin]")){
        const btn=document.createElement("button");
        btn.className="btn secondary pin-btn";
        btn.type="button";
        btn.dataset.pin=task.id;
        btn.textContent=task.pinned?"Unpin":"Pin";
        btn.onclick=()=>toggleTaskPin(task.id);
        actions.insertBefore(btn,actions.firstChild);
      }
    });

    const sorted=[...list.querySelectorAll(".task-card")].sort((a,b)=>{
      const ae=a.querySelector("[data-edit]"),be=b.querySelector("[data-edit]");
      const at=tasks.find(t=>String(t.id)===String(ae?.dataset.edit));
      const bt=tasks.find(t=>String(t.id)===String(be?.dataset.edit));
      return pinTaskSort(at||{},bt||{});
    });
    sorted.forEach(card=>list.appendChild(card));
  });
}

function decorateUpcomingDeadlinePins(){
  if(typeof upcomingDeadlines==="undefined"||!upcomingDeadlines)return;
  const upcoming=tasks.filter(t=>!t.archived&&t.status!=="Done"&&t.deadline&&deadlineDaysLeft(t.deadline)!==null)
    .sort((a,b)=>taskDeadlineSortValue(a)-taskDeadlineSortValue(b))
    .slice(0,5);
  const items=[...upcomingDeadlines.querySelectorAll(".upcoming-item")];
  items.forEach((item,index)=>{
    const task=upcoming[index];
    if(!task?.pinned)return;
    const title=item.querySelector("strong");
    if(title&&!title.querySelector(".dashboard-pin-mark")){
      const mark=document.createElement("span");
      mark.className="dashboard-pin-mark";
      mark.textContent="📌";
      mark.title="Pinned task";
      title.prepend(mark);
    }
  });
}

const pinStyle=document.createElement("style");
pinStyle.textContent=`.task-card.task-pinned{box-shadow:0 0 0 1px rgba(240,189,123,.34),0 8px 18px rgba(0,0,0,.14)}.task-card.task-pinned .task-title{display:flex;align-items:flex-start;gap:7px}.pin-mark{flex:0 0 auto;font-size:14px;line-height:1.25}.pin-btn{min-width:58px}.dashboard-pin-mark{display:inline-block;margin-right:7px;font-size:13px;vertical-align:1px}`;
document.head.appendChild(pinStyle);

const pinBaseRenderTasks=renderTasks;
renderTasks=function(){pinBaseRenderTasks();decoratePinnedCards();decorateUpcomingDeadlinePins()};

[taskSearch,taskStatusFilter,taskPriorityFilter,taskDeadlineFilter].forEach(el=>el.addEventListener(el===taskSearch?"input":"change",()=>setTimeout(()=>{decoratePinnedCards();decorateUpcomingDeadlinePins()},0)));

renderTasks();
