/**
 * Patient letters, drafted in English and Arabic for one affected record.
 *
 * Both come from fixed templates filled only from the record and the case: the
 * month of the test, the gene, the department that ordered it and the clinician
 * who owns the record. They are written for a patient, not a clinician: no
 * classification labels, no risk figures, no diagnosis, and nothing more
 * technical than the gene name.
 *
 * The Arabic draft uses the respectful plural throughout, which is the usual
 * register for formal correspondence and keeps the letter grammatically neutral
 * without reading anything from the record beyond what the English uses.
 *
 * Every letter is a draft until a clinician has reviewed it, and says so
 * wherever it is shown, copied or downloaded.
 */

/** The length a patient letter should stay within. */
export const LETTER_WORD_LIMIT = 150;

export const LETTER_DRAFT_NOTE = "Draft · must be reviewed by clinician before sending";

export interface LetterInput {
  caseId: string;
  recordId: string;
  gene: string;
  /** Date of the original test, `YYYY-MM-DD`. */
  testedOn: string;
  department: string;
  clinicalOwner: string;
}

export interface PatientLetter {
  english: string;
  arabic: string;
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

// Month names as written in the UAE. Fixed rather than taken from `Intl`, whose
// Arabic month names and digits vary between runtimes.
const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

/** Arabic names for the departments that order tests in this workspace. */
const DEPARTMENTS_AR: Record<string, string> = {
  "Breast Surgery": "قسم جراحة الثدي",
  Cardiology: "قسم أمراض القلب",
  "Clinical Genetics": "قسم الوراثة السريرية",
  Haematology: "قسم أمراض الدم",
  "Lipid Clinic": "عيادة الدهون",
  Oncology: "قسم الأورام",
  "Paediatric Genetics": "قسم وراثة الأطفال",
};

/** The department's Arabic name, or its English one when none is held. */
export function arabicDepartment(department: string): string {
  return DEPARTMENTS_AR[department] ?? department;
}

function monthYear(date: string, months: readonly string[]): string {
  const [year, month] = date.split("-");
  const name = months[Number(month) - 1];
  return name ? `${name} ${year}` : year;
}

export function composePatientLetter(input: LetterInput): PatientLetter {
  const { recordId, gene, testedOn, department, clinicalOwner } = input;
  const departmentAr = arabicDepartment(department);

  const english = [
    "Dear patient,",
    `Reference: ${recordId}`,
    `In ${monthYear(testedOn, EN_MONTHS)} you had a genetic test that looked at a gene called ${gene}. We are writing because new scientific research may change what that result means for you.`,
    "Your DNA has not changed. What has changed is how scientists understand it, as research has moved on since your test.",
    `We would like to explain this to you in person. Please book a follow-up appointment with the ${department} team at a time that suits you. You are welcome to bring a family member or friend.`,
    "If you have any questions before then, please contact us.",
    "Yours sincerely,",
    `${clinicalOwner}\n${department}`,
  ].join("\n\n");

  const arabic = [
    "تحية طيبة، وبعد،",
    `المرجع: ${recordId}`,
    `في ${monthYear(testedOn, AR_MONTHS)}، أجريتم فحصًا جينيًا لجينٍ يُسمّى ${gene}. نكتب إليكم لأن أبحاثًا علمية جديدة قد تُغيّر ما تعنيه نتيجة هذا الفحص بالنسبة إليكم.`,
    "لم يتغيّر حمضكم النووي (DNA). ما تغيّر هو فهم العلماء له، بعد أن تقدّمت الأبحاث منذ إجراء فحصكم.",
    `نودّ أن نشرح لكم ذلك شخصيًا. يُرجى حجز موعد متابعة مع فريق ${departmentAr} في الوقت الذي يناسبكم، ويمكنكم اصطحاب أحد أفراد العائلة أو صديق.`,
    "وإذا كانت لديكم أي أسئلة قبل ذلك، يُرجى التواصل معنا.",
    "مع خالص التحية،",
    `${clinicalOwner}\n${departmentAr}`,
  ].join("\n\n");

  return { english, arabic };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/* -- Rewording with a language model ---------------------------------------
   Optional. The model is given the filled templates and asked only to make
   them read better; whatever it returns must still carry every fact from the
   record and stay inside the letter's limits, or the template is kept.

   Nothing that identifies the record leaves the workspace. Before a letter is
   sent, the record reference, the month of the test, the team and the signing
   clinician are replaced by placeholders; the model rewords around them, and
   the real values go back in only when its reply is checked. The gene name is
   sent as written: it names a variant, not a person. */

/** What a letter sent for rewording carries in place of the record's facts. */
export const LETTER_PLACEHOLDERS = {
  reference: "{{REFERENCE}}",
  testDate: "{{TEST_DATE}}",
  team: "{{TEAM}}",
  clinician: "{{CLINICIAN}}",
} as const;

export const LETTER_SYSTEM_PROMPT = `You polish letters a genetics service sends to patients. You receive an English letter and its Arabic version, both filled in from a template.

Make each read more clearly and warmly for a patient with no medical training. Facts from the patient's record are written as placeholders in double braces: {{REFERENCE}}, {{TEST_DATE}}, {{TEAM}} and {{CLINICIAN}}. Copy every placeholder exactly as written, in both letters, wherever its fact belongs; never fill one in, translate it or drop it. Keep the gene name exactly as given. Keep the letter's three messages: new scientific research may change what the earlier test result means; the patient's DNA has not changed; they should book a follow-up appointment.
Keep each version under 150 words. Mention no diagnosis, risk, percentage or classification, use no medical term beyond the gene name, and add no facts.
Write the Arabic in Modern Standard Arabic, in the respectful plural, saying the same as the English.

Reply in exactly this layout and nothing else:
=== ENGLISH ===
the English letter
=== ARABIC ===
the Arabic letter`;

/** Each identifying fact as it appears in each language, beside its placeholder. */
function identifyingFacts(input: LetterInput): { english: [string, string][]; arabic: [string, string][] } {
  const { reference, testDate, team, clinician } = LETTER_PLACEHOLDERS;
  // Longest first, so a value that contains another is replaced whole.
  const byLength = (pairs: [string, string][]) =>
    pairs.filter(([value]) => value.length > 0).sort(([a], [b]) => b.length - a.length);
  return {
    english: byLength([
      [input.recordId, reference],
      [monthYear(input.testedOn, EN_MONTHS), testDate],
      [input.department, team],
      [input.clinicalOwner, clinician],
    ]),
    arabic: byLength([
      [input.recordId, reference],
      [monthYear(input.testedOn, AR_MONTHS), testDate],
      [arabicDepartment(input.department), team],
      [input.clinicalOwner, clinician],
    ]),
  };
}

/** The letter as a model may see it: no reference, date, team or clinician. */
export function redactLetter(letter: PatientLetter, input: LetterInput): PatientLetter {
  const facts = identifyingFacts(input);
  const redact = (text: string, pairs: [string, string][]) =>
    pairs.reduce((out, [value, token]) => out.replaceAll(value, token), text);
  return { english: redact(letter.english, facts.english), arabic: redact(letter.arabic, facts.arabic) };
}

/** Puts the record's facts back where a reply kept their placeholders. */
export function restoreLetter(letter: PatientLetter, input: LetterInput): PatientLetter {
  const facts = identifyingFacts(input);
  const restore = (text: string, pairs: [string, string][]) =>
    pairs.reduce((out, [value, token]) => out.replaceAll(token, value), text);
  return { english: restore(letter.english, facts.english), arabic: restore(letter.arabic, facts.arabic) };
}

/** What "Improve with AI" returns: the reworded letter, or the template it kept. */
export interface LetterImprovement extends PatientLetter {
  source: "ai" | "template";
  /** Why the template wording was kept. */
  reason?: string;
}

export function buildLetterPrompt(letter: PatientLetter): string {
  return `=== ENGLISH ===\n${letter.english}\n=== ARABIC ===\n${letter.arabic}`;
}

const EN_FORBIDDEN =
  /diagnos|risk|%|percent|pathogenic|benign|uncertain significance|\bVUS\b|variant|mutation|classif/i;
const AR_FORBIDDEN = /تشخيص|خطر|مخاطر|٪|%|طفرة|ممرض|حميد|تصنيف/;

/**
 * The model's letters, with the record's facts restored from their
 * placeholders, if both then carry every fact, the required messages and the
 * letter's limits; otherwise null.
 */
export function parseImprovedLetter(text: string, input: LetterInput): PatientLetter | null {
  const match = /=== ENGLISH ===\s*([\s\S]+?)\s*=== ARABIC ===\s*([\s\S]+)$/.exec(text.trim());
  if (!match) return null;
  const { english, arabic } = restoreLetter({ english: match[1].trim(), arabic: match[2].trim() }, input);
  // A placeholder left over means the reply invented or mangled one.
  if (/\{\{[A-Z_]+\}\}/.test(english) || /\{\{[A-Z_]+\}\}/.test(arabic)) return null;

  const shared = [input.recordId, input.gene, input.clinicalOwner];
  const englishHolds =
    [...shared, input.department, monthYear(input.testedOn, EN_MONTHS), "DNA"].every((fact) =>
      english.includes(fact),
    ) &&
    /not changed|hasn't changed|has not changed/i.test(english) &&
    /follow-up|appointment/i.test(english) &&
    !EN_FORBIDDEN.test(english);
  const arabicHolds =
    [...shared, arabicDepartment(input.department), monthYear(input.testedOn, AR_MONTHS)].every(
      (fact) => arabic.includes(fact),
    ) &&
    /النووي|DNA/.test(arabic) &&
    !AR_FORBIDDEN.test(arabic);

  const withinLimits =
    countWords(english) <= LETTER_WORD_LIMIT && countWords(arabic) <= LETTER_WORD_LIMIT;

  return englishHolds && arabicHolds && withinLimits ? { english, arabic } : null;
}

/** Both languages in one plain-text file, headed by the draft notice. */
export function letterFileText(input: LetterInput, letter: PatientLetter): string {
  return [
    LETTER_DRAFT_NOTE.toUpperCase(),
    `Patient letter · Case ${input.caseId} · Record ${input.recordId}`,
    "",
    "ENGLISH",
    "-------",
    letter.english.trim(),
    "",
    "العربية",
    "-------",
    letter.arabic.trim(),
    "",
  ].join("\n");
}
