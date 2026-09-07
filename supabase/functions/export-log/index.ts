import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

type LogRow = {
  log_date: string;
  completed: string | null;
  ongoing: string | null;
  blockers: string | null;
  next_plan: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replaceAll('"', '""')}"`;
}

function markdownSection(title: string, value: unknown) {
  const text = String(value ?? "").trim();
  return `### ${title}\n\n${text || "—"}\n`;
}

function logsToMarkdown(data: LogRow[], start: string, end: string) {
  let out = `# Daily Work Log\n\n**Period:** ${start} → ${end}\n\n`;
  for (const r of data) {
    out += `## ${r.log_date}\n\n`;
    out += `${markdownSection("Completed Today", r.completed)}\n`;
    out += `${markdownSection("Ongoing / In Progress", r.ongoing)}\n`;
    out += `${markdownSection("Blockers / Issues", r.blockers)}\n`;
    out += `${markdownSection("Next Plan", r.next_plan)}\n---\n\n`;
  }
  return out;
}

function logsToText(data: LogRow[], start: string, end: string) {
  let out = `DAILY WORK LOG\r\nPeriod: ${start} - ${end}\r\n${"=".repeat(64)}\r\n\r\n`;
  for (const r of data) {
    out += `${r.log_date}\r\n${"-".repeat(64)}\r\n`;
    out += `Completed Today:\r\n${r.completed || "-"}\r\n\r\n`;
    out += `Ongoing / In Progress:\r\n${r.ongoing || "-"}\r\n\r\n`;
    out += `Blockers / Issues:\r\n${r.blockers || "-"}\r\n\r\n`;
    out += `Next Plan:\r\n${r.next_plan || "-"}\r\n\r\n`;
  }
  return out;
}

function logsToCsv(data: LogRow[]) {
  const rows = [
    ["Date", "Completed Today", "Ongoing / In Progress", "Blockers / Issues", "Next Plan"],
    ...data.map((r) => [
      r.log_date,
      r.completed || "",
      r.ongoing || "",
      r.blockers || "",
      r.next_plan || "",
    ]),
  ];
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function logsToExcel(data: LogRow[]) {
  const rows = data.map((r) => ({
    Date: r.log_date,
    "Completed Today": r.completed || "",
    "Ongoing / In Progress": r.ongoing || "",
    "Blockers / Issues": r.blockers || "",
    "Next Plan": r.next_plan || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 }];
  ws["!autofilter"] = { ref: `A1:E${data.length + 1}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daily Work Log");
  const output = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(output as ArrayBuffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return responseJson({ error: "Method not allowed. Use GET." }, 405);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return responseJson({ error: "Missing Authorization: Bearer <access_token>." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return responseJson({ error: "Supabase environment is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return responseJson({ error: "Invalid or expired access token." }, 401);
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  if (!isDate(start) || !isDate(end)) {
    return responseJson({ error: "start and end must use YYYY-MM-DD format." }, 400);
  }
  if (start > end) {
    return responseJson({ error: "start cannot be later than end." }, 400);
  }
  if (!new Set(["xlsx", "csv", "md", "txt", "json"]).has(format)) {
    return responseJson({ error: "format must be one of: xlsx, csv, md, txt, json." }, 400);
  }

  const { data, error } = await supabase
    .from("daily_logs")
    .select("log_date,completed,ongoing,blockers,next_plan")
    .eq("user_id", userData.user.id)
    .gte("log_date", start)
    .lte("log_date", end)
    .order("log_date", { ascending: true });

  if (error) return responseJson({ error: error.message }, 500);

  const logs = (data || []) as LogRow[];
  if (logs.length === 0) {
    return responseJson({ error: "No saved Daily Work Logs were found in this date range." }, 404);
  }

  if (format === "json") {
    return responseJson({ start, end, count: logs.length, logs });
  }

  const base = `daily_work_log_${start}_to_${end}`;
  let body: BodyInit;
  let contentType: string;
  let extension = format;

  if (format === "xlsx") {
    body = logsToExcel(logs);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "md") {
    body = logsToMarkdown(logs, start, end);
    contentType = "text/markdown; charset=utf-8";
  } else if (format === "txt") {
    body = "\ufeff" + logsToText(logs, start, end);
    contentType = "text/plain; charset=utf-8";
  } else {
    body = logsToCsv(logs);
    contentType = "text/csv; charset=utf-8";
    extension = "csv";
  }

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${base}.${extension}"`,
      "Cache-Control": "no-store",
      "X-Export-Count": String(logs.length),
    },
  });
});
