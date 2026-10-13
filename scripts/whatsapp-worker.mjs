import process from "node:process";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);
const WHATSAPP_APP = "/Applications/WhatsApp.app";
const POLL_INTERVAL_MS = 3_000;
const MAX_ATTEMPTS = 5;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.platform !== "darwin" || !existsSync(WHATSAPP_APP)) {
  console.error("Worker ini memerlukan aplikasi WhatsApp Desktop di macOS.");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let polling = false;

async function sendWithWhatsAppDesktop(phone, message) {
  const deepLink = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  await execFileAsync("/usr/bin/open", ["-a", "WhatsApp", deepLink]);
  await new Promise((resolve) => setTimeout(resolve, 2_500));

  const appleScript = [
    'tell application "WhatsApp" to activate',
    "delay 1",
    'tell application "System Events"',
    '  if not (exists process "WhatsApp") then error "WhatsApp tidak berjalan"',
    '  tell process "WhatsApp"',
    "    keystroke return",
    "  end tell",
    "end tell",
  ].join("\n");

  await execFileAsync("/usr/bin/osascript", ["-e", appleScript]);
}

async function processNextMessage() {
  if (polling) return;
  polling = true;

  try {
    const { data, error } = await supabase.rpc("claim_next_whatsapp_message");
    if (error) throw error;

    const job = data?.[0];
    if (!job) return;

    try {
      await sendWithWhatsAppDesktop(job.recipient_phone, job.message);
      const { error: updateError } = await supabase
        .from("whatsapp_outbox")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message: "[DIHAPUS SETELAH TERKIRIM]",
          last_error: null,
        })
        .eq("id", job.id);
      if (updateError) throw updateError;
      console.log(`Pesan ${job.id} berhasil dikirim ke +${job.recipient_phone}.`);
    } catch (error) {
      const finalFailure = job.attempts >= MAX_ATTEMPTS;
      await supabase
        .from("whatsapp_outbox")
        .update({
          status: finalFailure ? "FAILED" : "PENDING",
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      console.error(`Pesan ${job.id} gagal${finalFailure ? " permanen" : ", akan dicoba lagi"}:`, error);
    }
  } catch (error) {
    console.error("Gagal membaca antrean WhatsApp:", error);
  } finally {
    polling = false;
  }
}

console.log("Worker WhatsApp Desktop OKESIH aktif untuk nomor super admin +62 856-9448-8510.");
console.log("Pastikan WhatsApp Desktop login dengan nomor tersebut dan izin Accessibility diberikan.");
setInterval(() => void processNextMessage(), POLL_INTERVAL_MS);
void processNextMessage();
