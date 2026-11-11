// Typed seed data. JSON files are the fixtures; this module gives them their domain types.
import type {
  Action, AuditLogEntry, Db, Evidence, Finding, ImportBatch, Participant, ParticipantContact, Question, Recruitment, Session, User,
} from "@/lib/types";
import users from "./users.json";
import questions from "./questions.json";
import participants from "./participants.json";
import contacts from "./contacts.json";
import recruitments from "./recruitments.json";
import sessions from "./sessions.json";
import evidence from "./evidence.json";
import findings from "./findings.json";
import actions from "./actions.json";
import importBatches from "./import-batches.json";
import audit from "./audit.json";

export function seedDb(): Db {
  // structuredClone so a reset never shares objects with a previous run.
  return structuredClone({
    users: users as User[],
    questions: questions as Question[],
    participants: participants as Participant[],
    contacts: contacts as ParticipantContact[],
    recruitments: recruitments as Recruitment[],
    sessions: sessions as Session[],
    evidence: evidence as Evidence[],
    findings: findings as Finding[],
    actions: actions as Action[],
    importBatches: importBatches as ImportBatch[],
    audit: audit as AuditLogEntry[],
  });
}

/** The demo CSV for the import wizard (SIMULATED CRM export). Synthetic rows, tuned to show each check:
 *  - a `shipping_address` column, which is not allowed
 *  - an unknown segment ("vip") which fails validation
 *  - a marketplace row from the export, which breaks the "marketplace = QR opt-in only" rule
 *  - CR-10021 already exists (P-003), which is a duplicate match
 *  - an order date after the export date, which the server refuses */
export const DEMO_IMPORT_FILE = {
  name: "crm-export-nov-2026.csv",
  text: [
    'customer_ref,segment,channel,source,sku,first_order_date,last_order_date,name,email,phone,shipping_address',
    'CR-20101,first-time,own-site,export,Shampoo 250 ml,2026-10-30,2026-10-30,Asha Kamath,asha.kamath@example.com,+91 98100 22001,"12 MG Road, Bengaluru"',
    'CR-20102,repeat,own-site,export,Moisturiser 200 ml,2026-06-14,2026-10-21,Dev Malhotra,dev.malhotra@example.com,+91 98100 22002,"4 Park Street, Kolkata"',
    'CR-20103,vip,own-site,export,Body wash 250 ml,2026-05-02,2026-10-11,Rhea Kapoor,rhea.k@example.com,+91 98100 22003,"9 Linking Road, Mumbai"',
    'CR-20104,one-time lapsed,own-site,export,Shampoo 250 ml,2026-08-29,2026-08-29,Sameer Ali,sameer.ali@example.com,+91 98100 22004,"22 Anna Salai, Chennai"',
    'CR-20105,frequent buyer,marketplace,export,Shampoo 650 ml,2026-07-20,2026-09-18,Nisha Rao,nisha.rao@example.com,+91 98100 22005,"7 FC Road, Pune"',
    'CR-10021,one-time lapsed,own-site,export,Shampoo 250 ml,2026-08-21,2026-08-21,Rohan Gupta,rohan.gupta@example.com,+91 98024 10714,"3 Residency Road, Bengaluru"',
    'CR-20107,repeat,own-site,export,Moisturiser 400 ml,2026-09-01,2026-12-02,Tara Sen,tara.sen@example.com,+91 98100 22007,"18 Salt Lake, Kolkata"',
    'CR-20108,first-time,own-site,export,Body wash 250 ml,2026-10-27,2026-10-27,Kunal Shah,kunal.shah@example.com,+91 98100 22008,"5 CG Road, Ahmedabad"',
  ].join("\n"),
};
