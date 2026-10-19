export type MarketingRegistration = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cityArea: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  experienceNotes: string | null;
  referralCode: string;
  status: string;
  createdAt: string;
  applicationReady: boolean;
  whatsappUrl: string;
};
