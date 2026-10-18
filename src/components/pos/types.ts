import type { DeviceOrder,useDeviceApp } from "@/lib/use-device-app";
export type HistoryProps = {
  data: NonNullable<ReturnType<typeof useDeviceApp>["data"]>;
  online: boolean;
  historyPin: string;
  lockHistory: () => void;
  setSelected: (order: DeviceOrder) => void;
  revision: number;
};
export type AuditPinProps = { onClose: () => void; onVerified: (pin: string) => void };
