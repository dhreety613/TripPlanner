// Single source of truth for the block protocol. Used by the server (validate model
// output + request bodies) AND the client (never trust the wire, validate again).
import { z } from 'zod';

export const CATEGORIES = ['food', 'sight', 'activity', 'transport', 'lodging', 'other'];

const str = (max) => z.string().trim().min(1).max(max);
// Optional fields degrade to `undefined` instead of rejecting the whole block:
// one bad optional value should not cost us a whole stop.
const optStr = (max) => z.string().trim().max(max).optional().catch(undefined);
const optNum = (min, max) => z.coerce.number().min(min).max(max).optional().catch(undefined);

export const TripBlock = z.object({
  type: z.literal('trip'),
  title: str(120),
  summary: optStr(600),
  currency: optStr(5),
});

export const DayBlock = z.object({
  type: z.literal('day'),
  day: z.coerce.number().int().min(1).max(30),
  title: str(120),
});

export const StopBlock = z.object({
  type: z.literal('stop'),
  day: z.coerce.number().int().min(1).max(30),
  name: str(120),
  time: optStr(20),
  category: z.enum(CATEGORIES).catch('other'),
  durationMin: z.coerce.number().int().min(5).max(1440).optional().catch(undefined),
  description: optStr(500),
  cost: optNum(0, 1_000_000),
  tip: optStr(300),
});

export const ChecklistBlock = z.object({
  type: z.literal('checklist'),
  title: str(120),
  items: z.array(str(160)).min(1).max(30),
});

export const ChartBlock = z.object({
  type: z.literal('chart'),
  title: str(120),
  unit: optStr(10),
  data: z
    .array(z.object({ label: str(40), value: z.coerce.number().min(0).max(1e9) }))
    .min(1)
    .max(12),
});

export const TipBlock = z.object({ type: z.literal('tip'), text: str(300) });

export const Block = z.discriminatedUnion('type', [
  TripBlock,
  DayBlock,
  StopBlock,
  ChecklistBlock,
  ChartBlock,
  TipBlock,
]);

export const MAX_BLOCKS = 250;
export const MAX_PROMPT = 1000;

export const PlanRequest = z.object({
  prompt: z.string().trim().min(3, 'Describe your trip in a few words').max(MAX_PROMPT),
  // Present on refinement turns: the current plan serialised as blocks.
  current: z.array(Block).max(MAX_BLOCKS).optional(),
});

export function parseBlock(obj) {
  const r = Block.safeParse(obj);
  if (r.success) return { ok: true, block: r.data };
  const i = r.error.issues[0];
  return { ok: false, reason: `${i.path.join('.') || 'block'}: ${i.message}` };
}
