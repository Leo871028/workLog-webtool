let calendarCursor=new Date();calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);

function calendarDateString(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`}
function calendarMonthTitle(d){return d.toLocaleDateString(undefined,{year:"numeric",month:"long"})}
function calendarActiveTasks(){return tasks.filter(t=>!t.archived&&t.deadline)}
function calendarFilteredTasks(){const status=calendarStatusFilter?.value||"all";return calendarActiveTasks().filter(t=>status==="all"||t.status===status)}
function calendarTaskState(t){if(t.status==="Done")return"done";const days=deadlineDaysLeft(t.deadline);if(days!==null&&days<0)return"overdue";return t.status==="Ongoing"?"ongoing":"todo"}
function calendarTaskLabel(t){const days=deadlineDaysLeft(t.deadline);if(t.status==="Done")return"Done";if(days!==null&&days<0)return"Overdue";return t.status}

function renderCalendar(){
  if(typeof calendarGrid==="undefined")return;
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  calendarMonthLabel.textContent=calendarMonthTitle(calendarCursor);
  const firstDay=new Date(y,m,1).getDay(),daysInMonth=new Date(y,m+1,0).getDate(),prevMonthDays=new Date(y,m,0).getDate();
  const byDate={};calendarFilteredTasks().forEach(t=>{(byDate[t.deadline]??=[]).push(t)});
  Object.values(byDate).forEach(list=>list.sort((a,b)=>rank(a.priority)-rank(b.priority)||String(a.title).localeCompare(String(b.title))));
  const today=todayString();let html="";
  for(let i=0;i<42;i++){
    let day,cellDate,other=false;
    if(i<firstDay){day=prevMonthDays-firstDay+i+1;const d=new Date(y,m-1,day);cellDate=calendarDateString(d.getFullYear(),d.getMonth(),d.getDate());other=true}
    else if(i>=firstDay+daysInMonth){day=i-firstDay-daysInMonth+1;const d=new Date(y,m+1,day);cellDate=calendarDateString(d.getFullYear(),d.getMonth(),d.getDate());other=true}
    else{day=i-firstDay+1;cellDate=calendarDateString(y,m,day)}
    const events=(byDate[cellDate]||[]).map(t=>`<button class="calendar-task ${calendarTaskState(t)}" type="button" data-calendar-task="${t.id}" title="${esc(t.title)}"><span>${esc(t.title)}</span><small>${esc(calendarTaskLabel(t))} · ${esc(t.priority)}</small></button>`).join("");
    html+=`<div class="calendar-day${other?" other-month":""}${cellDate===today?" today":""}" data-date="${cellDate}"><div class="calendar-day-number">${day}${cellDate===today?'<span>Today</span>':""}</div><div class="calendar-events">${events}</div></div>`;
  }
  calendarGrid.innerHTML=html;
  const currentMonthTasks=calendarFilteredTasks().filter(t=>String(t.deadline).startsWith(`${y}-${String(m+1).padStart(2,"0")}-`));
  calendarTaskCount.textContent=`${currentMonthTasks.length} task${currentMonthTasks.length===1?"":"s"} with deadlines this month`;
  document.querySelectorAll("[data-calendar-task]").forEach(b=>b.onclick=()=>openEditTask(b.dataset.calendarTask));
}

function calendarMoveMonth(n){calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+n,1);renderCalendar()}
function calendarGoToday(){const d=new Date();calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()}

function initCalendarView(){
  if(document.getElementById("calendar-view"))return;
  const style=document.createElement("style");style.textContent=`
.calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;padding:16px 18px;background:linear-gradient(180deg,#213346 0%,#1b2a39 100%)}.calendar-toolbar-left,.calendar-toolbar-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.calendar-month-label{margin:0 8px;min-width:150px;text-align:center;font-size:20px;font-weight:800;color:#f1f5f9}.calendar-toolbar label{display:flex;align-items:center;gap:8px}.calendar-toolbar select{width:auto;min-width:120px}.calendar-task-count{color:#9fb0c0;font-size:12px;font-weight:700}.calendar-wrap{overflow-x:auto;border:1px solid #3b5064;border-radius:16px;background:#162535}.calendar-weekdays,.calendar-grid{min-width:850px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.calendar-weekdays{background:#203246;border-bottom:1px solid #3b5064}.calendar-weekdays div{padding:10px;text-align:center;color:#9fb0c0;font-size:12px;font-weight:800}.calendar-day{min-height:132px;padding:8px;border-right:1px solid rgba(67,90,112,.5);border-bottom:1px solid rgba(67,90,112,.5);background:#1a2a39}.calendar-day:nth-child(7n){border-right:0}.calendar-day.other-month{background:#142230;opacity:.55}.calendar-day.today{box-shadow:inset 0 0 0 2px rgba(93,159,232,.8);background:#1d3144}.calendar-day-number{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:7px;color:#c8d4df;font-size:12px;font-weight:800}.calendar-day-number span{padding:2px 5px;border-radius:999px;background:#315b83;color:#a9d1ff;font-size:9px}.calendar-events{display:grid;gap:5px}.calendar-task{width:100%;display:grid;gap:2px;text-align:left;border:1px solid #456079;border-left-width:3px;border-radius:9px;padding:6px 7px;background:#253748;color:#edf3f8;cursor:pointer;overflow:hidden}.calendar-task span{font-size:11px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.calendar-task small{font-size:9px;color:#aab8c5}.calendar-task.todo{border-left-color:#d07b88}.calendar-task.ongoing{border-left-color:#5d9fe8}.calendar-task.done{border-left-color:#61b886;opacity:.72}.calendar-task.overdue{border-left-color:#d06b74;background:rgba(125,55,65,.27)}.calendar-task:hover{filter:brightness(1.1)}.calendar-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;color:#9fb0c0;font-size:12px}.calendar-legend span{display:flex;align-items:center;gap:6px}.calendar-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.calendar-legend .todo{background:#d07b88}.calendar-legend .ongoing{background:#5d9fe8}.calendar-legend .done{background:#61b886}.calendar-legend .overdue{background:#d06b74}@media(max-width:700px){.calendar-toolbar{align-items:stretch;flex-direction:column}.calendar-toolbar-left,.calendar-toolbar-right{justify-content:space-between}.calendar-month-label{min-width:120px;font-size:18px}}
  `;document.head.appendChild(style);
  const tab=document.createElement("button");tab.className="tab";tab.dataset.tab="calendar-view";tab.textContent="Calendar";
  const backupTab=document.querySelector('.tab[data-tab="backup-restore"]');document.querySelector(".tabs").insertBefore(tab,backupTab||null);
  const page=document.createElement("section");page.id="calendar-view";page.className="page";page.innerHTML=`<section class="card calendar-toolbar"><div class="calendar-toolbar-left"><button id="calendarPrevBtn" class="btn secondary" type="button">Prev</button><h2 id="calendarMonthLabel" class="calendar-month-label"></h2><button id="calendarNextBtn" class="btn secondary" type="button">Next</button><button id="calendarTodayBtn" class="btn primary" type="button">Today</button></div><div class="calendar-toolbar-right"><span id="calendarTaskCount" class="calendar-task-count"></span><label>Status<select id="calendarStatusFilter"><option value="all">All</option><option>Todo</option><option>Ongoing</option><option>Done</option></select></label></div></section><div class="calendar-wrap"><div class="calendar-weekdays"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div><div id="calendarGrid" class="calendar-grid"></div></div><div class="calendar-legend"><span><i class="todo"></i>Todo</span><span><i class="ongoing"></i>Ongoing</span><span><i class="done"></i>Done</span><span><i class="overdue"></i>Overdue</span></div>`;
  document.querySelector("main").appendChild(page);
  tab.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));tab.classList.add("active");page.classList.add("active");renderCalendar()};
  calendarPrevBtn.onclick=()=>calendarMoveMonth(-1);calendarNextBtn.onclick=()=>calendarMoveMonth(1);calendarTodayBtn.onclick=calendarGoToday;calendarStatusFilter.onchange=renderCalendar;
  renderCalendar();
}

const calendarBaseLoadTasks=loadTasks;
loadTasks=async function(){await calendarBaseLoadTasks();renderCalendar()};
initCalendarView();
