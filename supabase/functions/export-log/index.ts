import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

type LogRow={log_date:string;work_hours:number|null;completed:string|null;ongoing:string|null};
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-api-key, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};
function responseJson(body:unknown,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function isDate(value:string|null):value is string{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const[y,m,d]=value.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d}
function safeEqual(a:string,b:string){const enc=new TextEncoder(),aa=enc.encode(a),bb=enc.encode(b);if(aa.length!==bb.length)return false;let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0}
function csvCell(value:unknown){let s=String(value??"");if(/^[=+\-@]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`}
function markdownSection(title:string,value:unknown){const text=String(value??"").trim();return `### ${title}\n\n${text||"—"}\n`}
function displayWorkHours(value:number|null){return value===null||value===undefined?"—":`${Number(value)} h`}
function logsToMarkdown(data:LogRow[],start:string,end:string){let out=`# Daily Work Log\n\n**Period:** ${start} → ${end}\n\n`;for(const r of data)out+=`## ${r.log_date}\n\n**Work Hours:** ${displayWorkHours(r.work_hours)}\n\n${markdownSection("Completed Today",r.completed)}\n${markdownSection("Ongoing / In Progress",r.ongoing)}\n---\n\n`;return out}
function logsToText(data:LogRow[],start:string,end:string){let out=`DAILY WORK LOG\r\nPeriod: ${start} - ${end}\r\n${"=".repeat(64)}\r\n\r\n`;for(const r of data)out+=`${r.log_date}\r\n${"-".repeat(64)}\r\nWork Hours: ${displayWorkHours(r.work_hours)}\r\n\r\nCompleted Today:\r\n${r.completed||"-"}\r\n\r\nOngoing / In Progress:\r\n${r.ongoing||"-"}\r\n\r\n`;return out}
function logsToCsv(data:LogRow[]){const rows=[["Date","Work Hours","Completed Today","Ongoing / In Progress"],...data.map(r=>[r.log_date,r.work_hours??"",r.completed||"",r.ongoing||""])];return "\ufeff"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")}
function logsToExcel(data:LogRow[]){const rows=data.map(r=>({Date:r.log_date,"Work Hours":r.work_hours??"","Completed Today":r.completed||"","Ongoing / In Progress":r.ongoing||""})),ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=[{wch:14},{wch:12},{wch:45},{wch:45}];ws["!autofilter"]={ref:`A1:D${data.length+1}`};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Daily Work Log");return new Uint8Array(XLSX.write(wb,{bookType:"xlsx",type:"array"}) as ArrayBuffer)}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 if(req.method!=="GET")return responseJson({error:"Method not allowed. Use GET."},405);
 const suppliedKey=req.headers.get("x-api-key")||"",expectedKey=Deno.env.get("EXPORT_API_KEY")||"";
 if(!expectedKey)return responseJson({error:"EXPORT_API_KEY secret is not configured."},500);
 if(!suppliedKey||!safeEqual(suppliedKey,expectedKey))return responseJson({error:"Invalid or missing X-API-Key."},401);
 const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),exportUserId=Deno.env.get("EXPORT_USER_ID");
 if(!supabaseUrl||!serviceKey||!exportUserId)return responseJson({error:"SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or EXPORT_USER_ID is not configured."},500);
 const url=new URL(req.url),start=url.searchParams.get("start"),end=url.searchParams.get("end"),format=(url.searchParams.get("format")||"csv").toLowerCase();
 if(!isDate(start)||!isDate(end))return responseJson({error:"start and end must use YYYY-MM-DD format."},400);
 if(start>end)return responseJson({error:"start cannot be later than end."},400);
 if(!new Set(["xlsx","csv","md","txt","json"]).has(format))return responseJson({error:"format must be one of: xlsx, csv, md, txt, json."},400);
 const supabase=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data,error}=await supabase.from("daily_logs").select("log_date,work_hours,completed,ongoing").eq("user_id",exportUserId).gte("log_date",start).lte("log_date",end).order("log_date",{ascending:true});
 if(error)return responseJson({error:error.message},500);const logs=(data||[]) as LogRow[];if(!logs.length)return responseJson({error:"No saved Daily Work Logs were found in this date range."},404);
 if(format==="json")return responseJson({start,end,count:logs.length,logs});
 const base=`daily_work_log_${start}_to_${end}`;let body:BodyInit,contentType:string,extension=format;
 if(format==="xlsx"){body=logsToExcel(logs);contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}else if(format==="md"){body=logsToMarkdown(logs,start,end);contentType="text/markdown; charset=utf-8"}else if(format==="txt"){body="\ufeff"+logsToText(logs,start,end);contentType="text/plain; charset=utf-8"}else{body=logsToCsv(logs);contentType="text/csv; charset=utf-8";extension="csv"}
 return new Response(body,{status:200,headers:{...corsHeaders,"Content-Type":contentType,"Content-Disposition":`attachment; filename="${base}.${extension}"`,"Cache-Control":"no-store","X-Export-Count":String(logs.length)}});
});
