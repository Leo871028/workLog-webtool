const BACKUP_VERSION=1;

function backupDownload(content,fileName){
  const blob=new Blob([content],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function safeTaskForBackup(t){
  return {
    id:t.id,
    title:String(t.title||""),
    description:String(t.description||""),
    priority:["Low","Medium","High"].includes(t.priority)?t.priority:"Medium",
    status:["Todo","Ongoing","Done"].includes(t.status)?t.status:"Todo",
    deadline:t.deadline||null,
    archived:Boolean(t.archived),
    archived_at:t.archived_at||null,
    created_at:t.created_at||null,
    updated_at:t.updated_at||null
  };
}

function safeLogForBackup(r){
  return {
    log_date:r.log_date,
    completed:String(r.completed||""),
    ongoing:String(r.ongoing||""),
    blockers:String(r.blockers||""),
    next_plan:String(r.next_plan||""),
    created_at:r.created_at||null,
    updated_at:r.updated_at||null
  };
}

async function createFullBackup(){
  if(!currentUser)return alert("Please sign in first.");
  backupBtn.disabled=true;
  const oldText=backupBtn.textContent;
  backupBtn.textContent="Creating Backup...";
  try{
    const [taskResult,logResult]=await Promise.all([
      db.from("tasks").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:true}),
      db.from("daily_logs").select("*").eq("user_id",currentUser.id).order("log_date",{ascending:true})
    ]);
    if(taskResult.error)throw taskResult.error;
    if(logResult.error)throw logResult.error;
    const payload={
      app:"Work Task Tracker",
      backup_version:BACKUP_VERSION,
      exported_at:new Date().toISOString(),
      counts:{tasks:(taskResult.data||[]).length,daily_logs:(logResult.data||[]).length},
      tasks:(taskResult.data||[]).map(safeTaskForBackup),
      daily_logs:(logResult.data||[]).map(safeLogForBackup)
    };
    backupDownload(JSON.stringify(payload,null,2),`work_task_tracker_backup_${todayString()}.json`);
    toast(`Backup created: ${payload.counts.tasks} task${payload.counts.tasks===1?"":"s"}, ${payload.counts.daily_logs} log${payload.counts.daily_logs===1?"":"s"}.`);
  }catch(e){
    alert(e.message||String(e));
  }finally{
    backupBtn.disabled=false;
    backupBtn.textContent=oldText;
  }
}

function validDateString(v){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)}
function validUuid(v){return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}

function validateBackup(data){
  if(!data||typeof data!=="object")throw new Error("Invalid backup file.");
  if(data.app!=="Work Task Tracker")throw new Error("This file is not a Work Task Tracker backup.");
  if(Number(data.backup_version)!==BACKUP_VERSION)throw new Error(`Unsupported backup version: ${data.backup_version}.`);
  if(!Array.isArray(data.tasks)||!Array.isArray(data.daily_logs))throw new Error("Backup file is missing tasks or daily_logs.");
  data.tasks.forEach((t,i)=>{
    if(!t||typeof t!=="object"||!String(t.title||"").trim())throw new Error(`Invalid task at item ${i+1}.`);
    if(t.id!=null&&!validUuid(t.id))throw new Error(`Invalid task ID at item ${i+1}.`);
    if(!["Low","Medium","High"].includes(t.priority))throw new Error(`Invalid task priority at item ${i+1}.`);
    if(!["Todo","Ongoing","Done"].includes(t.status))throw new Error(`Invalid task status at item ${i+1}.`);
    if(t.deadline!=null&&t.deadline!==""&&!validDateString(t.deadline))throw new Error(`Invalid task deadline at item ${i+1}.`);
    if(t.archived!=null&&typeof t.archived!=="boolean")throw new Error(`Invalid archive flag at task ${i+1}.`);
  });
  data.daily_logs.forEach((r,i)=>{
    if(!r||typeof r!=="object"||!validDateString(r.log_date))throw new Error(`Invalid Daily Work Log at item ${i+1}.`);
  });
  return data;
}

function taskRestoreRow(t){
  const row={
    user_id:currentUser.id,
    title:String(t.title||"").trim(),
    description:String(t.description||""),
    priority:t.priority,
    status:t.status,
    deadline:t.deadline||null,
    archived:Boolean(t.archived),
    archived_at:t.archived? (t.archived_at||new Date().toISOString()) : null,
    updated_at:t.updated_at||new Date().toISOString()
  };
  if(validUuid(t.id))row.id=t.id;
  if(t.created_at)row.created_at=t.created_at;
  return row;
}

function logRestoreRow(r){
  const row={
    user_id:currentUser.id,
    log_date:r.log_date,
    completed:String(r.completed||""),
    ongoing:String(r.ongoing||""),
    blockers:String(r.blockers||""),
    next_plan:String(r.next_plan||""),
    updated_at:r.updated_at||new Date().toISOString()
  };
  if(r.created_at)row.created_at=r.created_at;
  return row;
}

async function restoreBackupFile(){
  if(!currentUser)return alert("Please sign in first.");
  const file=restoreFile.files?.[0];
  if(!file)return alert("Please choose a backup JSON file first.");
  let data;
  try{
    data=validateBackup(JSON.parse(await file.text()));
  }catch(e){
    return alert(e.message||"Invalid backup file.");
  }
  const mode=restoreMode.value;
  const replace=mode==="replace";
  const action=replace?"REPLACE all current Tasks and Daily Work Logs":"MERGE this backup into your current data";
  if(!confirm(`Restore ${data.tasks.length} task(s) and ${data.daily_logs.length} Daily Work Log(s)?\n\nMode: ${replace?"Replace All":"Merge"}\n\nThis will ${action}.`))return;

  restoreBtn.disabled=true;
  backupBtn.disabled=true;
  const oldText=restoreBtn.textContent;
  restoreBtn.textContent="Restoring...";
  try{
    if(replace){
      const taskDelete=await db.from("tasks").delete().eq("user_id",currentUser.id);
      if(taskDelete.error)throw taskDelete.error;
      const logDelete=await db.from("daily_logs").delete().eq("user_id",currentUser.id);
      if(logDelete.error)throw logDelete.error;
    }

    if(data.tasks.length){
      const rows=data.tasks.map(taskRestoreRow);
      const result=await db.from("tasks").upsert(rows,{onConflict:"id"});
      if(result.error)throw result.error;
    }
    if(data.daily_logs.length){
      const rows=data.daily_logs.map(logRestoreRow);
      const result=await db.from("daily_logs").upsert(rows,{onConflict:"user_id,log_date"});
      if(result.error)throw result.error;
    }

    await Promise.all([loadTasks(),loadLogs()]);
    restoreFile.value="";
    restoreFileName.textContent="No file selected";
    toast(`Restore complete: ${data.tasks.length} task${data.tasks.length===1?"":"s"}, ${data.daily_logs.length} log${data.daily_logs.length===1?"":"s"}.`);
  }catch(e){
    alert(`Restore failed: ${e.message||String(e)}`);
  }finally{
    restoreBtn.disabled=false;
    backupBtn.disabled=false;
    restoreBtn.textContent=oldText;
  }
}

function initBackupRestore(){
  if(typeof backupBtn==="undefined")return;
  backupBtn.onclick=createFullBackup;
  restoreBtn.onclick=restoreBackupFile;
  restoreFile.onchange=()=>{restoreFileName.textContent=restoreFile.files?.[0]?.name||"No file selected"};
}

initBackupRestore();
