export interface DemoMenu {
  id: string;
  nama: string;
  harga: number;
  kategori: string;
  desc_menu: string | null;
}

export interface DemoTable {
  id: string;
  label: string;
}

export interface DemoProfile {
  id: string;
  nama: string;
  slug: string;
  logo_url: string | null;
  qris_image_url: string | null;
  qris_merchant_name: string | null;
  is_active: boolean;
}

export interface DemoPayload {
  profile: DemoProfile;
  menus: DemoMenu[];
  tables: DemoTable[];
}

export function isDemoSlug(slug: string): boolean {
  const clean = (slug || "").toLowerCase().trim();
  return clean === "demo" || clean === "giras-nusantara";
}

export const DEMO_MENU_DATA: DemoPayload = {
  profile: {
    id: "00000000-0000-4000-8000-000000000000",
    nama: "Warkop Nusantara",
    slug: "demo",
    logo_url: "/logo.svg?v=2",
    qris_image_url: "https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=OKESIH-DEMO-SIMULASI-PEMBAYARAN",
    qris_merchant_name: "OKESIH DEMO RESTO",
    is_active: true,
  },
  tables: [
    { id: "00000000-0000-4000-8000-000000000101", label: "01" },
    { id: "00000000-0000-4000-8000-000000000102", label: "02" },
    { id: "00000000-0000-4000-8000-000000000103", label: "03" },
    { id: "00000000-0000-4000-8000-000000000104", label: "04" },
    { id: "00000000-0000-4000-8000-000000000105", label: "05" },
    { id: "00000000-0000-4000-8000-000000000106", label: "06" },
    { id: "00000000-0000-4000-8000-000000000107", label: "07" },
    { id: "00000000-0000-4000-8000-000000000108", label: "08" },
    { id: "00000000-0000-4000-8000-000000000109", label: "09" },
    { id: "00000000-0000-4000-8000-000000000110", label: "10" },
  ],
  menus: [
    // ☕ Kopi & Minuman Panas
    {
      id: "00000000-0000-4000-8000-000000000001",
      nama: "Kopi Tubruk Nusantara",
      harga: 8000,
      kategori: "Kopi",
      desc_menu: "Kopi hitam racikan biji robusta nusantara pilihan dengan aroma harum dan rasa pekat mantap.",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      nama: "Kopi Susu Gula Aren",
      harga: 15000,
      kategori: "Kopi",
      desc_menu: "Espresso berpadu susu segar gurih dan manis legitnya gula aren murni.",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      nama: "Kopi Tarik Aceh",
      harga: 14000,
      kategori: "Kopi",
      desc_menu: "Kopi pekat berbuih lembut ditarik manual dengan cita rasa otentik serambi mekkah.",
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      nama: "Kopi Vietnam Drip",
      harga: 13000,
      kategori: "Kopi",
      desc_menu: "Kopi tetes lambat disajikan di atas susu kental manis legit nikmat.",
    },
    {
      id: "00000000-0000-4000-8000-000000000005",
      nama: "Teh Tarik Hangat",
      harga: 10000,
      kategori: "Minuman",
      desc_menu: "Seduhan teh hitam wangi berpadu krimer manis lembut berbuih.",
    },
    {
      id: "00000000-0000-4000-8000-000000000006",
      nama: "Wedang Jahe Susu",
      harga: 12000,
      kategori: "Minuman",
      desc_menu: "Rebusan jahe merah segar dengan rempah alami dan susu kental manis hangat.",
    },

    // 🥤 Minuman Dingin & Segar
    {
      id: "00000000-0000-4000-8000-000000000007",
      nama: "Es Kopi Susu Creamy",
      harga: 18000,
      kategori: "Kopi",
      desc_menu: "Kopi susu dingin ekstra creamy dan menyegarkan di cuaca terik.",
    },
    {
      id: "00000000-0000-4000-8000-000000000008",
      nama: "Es Teh Manis Jumbo",
      harga: 6000,
      kategori: "Minuman",
      desc_menu: "Teh melati wangi seduhan segar porsi jumbo pelepas dahaga.",
    },
    {
      id: "00000000-0000-4000-8000-000000000009",
      nama: "Es Jeruk Peras Murni",
      harga: 10000,
      kategori: "Minuman",
      desc_menu: "Perasan jeruk asli alami segar dingin kaya vitamin C.",
    },
    {
      id: "00000000-0000-4000-8000-000000000010",
      nama: "Es Matcha Latte",
      harga: 20000,
      kategori: "Minuman",
      desc_menu: "Green tea matcha lembut berpadu susu dingin segar full cream.",
    },
    {
      id: "00000000-0000-4000-8000-000000000011",
      nama: "Es Cokelat Klasik",
      harga: 16000,
      kategori: "Minuman",
      desc_menu: "Cokelat pekat dingin dengan taburan serpihan cokelat gurih.",
    },

    // 🍽️ Makanan Utama
    {
      id: "00000000-0000-4000-8000-000000000012",
      nama: "Mie Nyemek Spesial Telur",
      harga: 18000,
      kategori: "Makanan",
      desc_menu: "Mie kuah kental gurih pedas dengan telur orak-arik dan sawi hijau segar.",
    },
    {
      id: "00000000-0000-4000-8000-000000000013",
      nama: "Nasi Goreng Kampung Spesial",
      harga: 22000,
      kategori: "Makanan",
      desc_menu: "Nasi goreng bumbu kampung harum dengan telur mata sapi, acar, dan kerupuk.",
    },
    {
      id: "00000000-0000-4000-8000-000000000014",
      nama: "Nasi Ayam Geprek Sambal Korek",
      harga: 25000,
      kategori: "Makanan",
      desc_menu: "Ayam krispi gurih diulek sambal korek pedas segar disajikan dengan lalapan.",
    },
    {
      id: "00000000-0000-4000-8000-000000000015",
      nama: "Mie Dok-Dok Kuah Pedas",
      harga: 19000,
      kategori: "Makanan",
      desc_menu: "Mie rebus kuah gurih kental khas warkop dengan suwiran ayam dan telur.",
    },
    {
      id: "00000000-0000-4000-8000-000000000016",
      nama: "Nasi Gila Warkop",
      harga: 23000,
      kategori: "Makanan",
      desc_menu: "Nasi hangat bertabur tumisan sosis, bakso, dan telur bumbu gurih pedas mantap.",
    },

    // 🥐 Camilan & Roti
    {
      id: "00000000-0000-4000-8000-000000000017",
      nama: "Pisang Goreng Keju Cokelat",
      harga: 15000,
      kategori: "Camilan",
      desc_menu: "Pisang kepok manis garing bertabur keju parut cheddar dan cokelat leleh.",
    },
    {
      id: "00000000-0000-4000-8000-000000000018",
      nama: "Roti Bakar Cokelat Keju",
      harga: 16000,
      kategori: "Camilan",
      desc_menu: "Roti tebal panggang mentega garing di luar dengan isian lumer melimpah.",
    },
    {
      id: "00000000-0000-4000-8000-000000000019",
      nama: "Cireng Krispi Bumbu Rujak",
      harga: 12000,
      kategori: "Camilan",
      desc_menu: "Cireng kenyal renyah gurih disajikan hangat dengan cocolan rujak pedas manis.",
    },
    {
      id: "00000000-0000-4000-8000-000000000020",
      nama: "Kentang Goreng Sausage Mix",
      harga: 17000,
      kategori: "Camilan",
      desc_menu: "French fries renyah keemasan dipadu potongan sosis goreng gurih.",
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      nama: "Tahu Crispy Cabai Garam",
      harga: 12000,
      kategori: "Camilan",
      desc_menu: "Tahu pong garing ditumis irisan cabai rawit merah dan daun bawang harum.",
    },
  ],
};
