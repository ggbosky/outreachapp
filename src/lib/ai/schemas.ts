import { z } from "zod";

export const ResearchSchema = z.object({
  company_summary: z.string().describe("2–4 věty: čemu se firma věnuje, pro koho a jak"),
  services: z.array(z.string()).describe("Hlavní služby / produkty"),
  target_customers: z.string().describe("Kdo jsou jejich zákazníci"),
  strengths: z.array(z.string()).describe("Hlavní přednosti a USP firmy"),
  weaknesses: z.array(z.string()).describe("Slabá místa viditelná z webu (web, marketing, procesy, nabídka…)"),
  opportunities: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().describe("Co přesně jsme na webu viděli / co chybí"),
        how_we_help: z.string().describe("Jak konkrétně pomůže naše služba"),
      }),
    )
    .describe("Příležitosti, kde jim naše služba pomůže – seřazené od nejsilnější"),
  icebreaker: z.string().describe("Unikátní, konkrétní háček do prvního e-mailu (1–2 věty)"),
  contact_person: z
    .object({ name: z.string(), role: z.string() })
    .nullable()
    .describe("Rozhodovací osoba nalezená na webu, jinak null"),
  fit_score: z.number().int().describe("Vhodnost leadu 1–10"),
  fit_reason: z.string(),
  language: z.string().describe("Jazyk komunikace – kód jazyka webu, např. cs, sk, en"),
});
export type ResearchResult = z.infer<typeof ResearchSchema>;

export const OutreachSchema = z.object({
  emails: z
    .array(
      z.object({
        step: z.number().int().describe("0 = první e-mail, 1 = follow-up 1, 2 = follow-up 2"),
        subject: z.string(),
        body: z.string().describe("Text e-mailu bez podpisu, s oslovením; odstavce oddělené prázdným řádkem"),
      }),
    )
    .describe("Přesně 3 e-maily: úvodní + 2 follow-upy"),
  linkedin: z.object({
    connection_note: z.string().describe("Poznámka k žádosti o propojení, max 300 znaků"),
    message: z.string().describe("Zpráva po přijetí propojení"),
  }),
});
export type OutreachResult = z.infer<typeof OutreachSchema>;

export const SentimentSchema = z.object({
  sentiment: z.enum(["INTERESTED", "NOT_INTERESTED", "PRICE_INQUIRY", "QUESTION", "NEUTRAL"]),
  summary: z.string().describe("Shrnutí odpovědi v 1 větě česky"),
  suggested_next_step: z.string().describe("Doporučený další krok česky"),
});
export type SentimentResult = z.infer<typeof SentimentSchema>;
