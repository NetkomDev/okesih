const witaHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Makassar", hour: "2-digit", hourCycle: "h23",
});

export function ownerWhatsAppContact(businessName: string, now = new Date()) {
  const hour = Number(witaHour.format(now));
  const greeting = hour >= 4 && hour < 11 ? "pagi"
    : hour >= 11 && hour < 15 ? "siang"
    : hour >= 15 && hour < 18 ? "sore" : "malam";
  const identity = businessName.trim() ? `Saya owner dari ${businessName.trim()}.` : "Saya pengguna dashboard Owner OKESIH.";
  const message = `Selamat ${greeting}, Admin OKESIH. ${identity} Mohon bantuan terkait layanan OKESIH. Terima kasih.`;
  return {
    isWorkingHours: hour >= 9 && hour < 20,
    url: `https://wa.me/6285694488510?text=${encodeURIComponent(message)}`,
  };
}
