import { z } from "zod";

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const historyQuerySchema = paginationSchema.extend({
  period: z.enum(["today", "this_week", "this_month", "this_year", "custom", "all"]).default("today"),
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  status: z.enum(["ALL", "AWAITING_CONFIRMATION", "COOKING", "READY", "DONE", "VOID", "REJECTED"]).default("ALL"),
  payment: z.enum(["ALL", "CASH", "QRIS"]).default("ALL"),
  search: z.string().trim().max(120).default(""),
}).superRefine((value, ctx) => {
  if (value.period === "custom" && (!value.start || !value.end || value.start > value.end)) {
    ctx.addIssue({ code: "custom", message: "Rentang tanggal tidak valid.", path: ["start"] });
  }
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
