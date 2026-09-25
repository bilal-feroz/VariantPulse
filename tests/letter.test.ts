import { describe, expect, it } from "vitest";

import { PATIENTS, VARIANT_BY_KEY } from "@/data/workspace";
import {
  LETTER_DRAFT_NOTE,
  LETTER_WORD_LIMIT,
  arabicDepartment,
  composePatientLetter,
  countWords,
  letterFileText,
  parseImprovedLetter,
  type LetterInput,
} from "@/lib/letter";

const input: LetterInput = {
  caseId: "VP-R-2026-001",
  recordId: "VP-10247",
  gene: "BRCA1",
  testedOn: "2023-03-14",
  department: "Clinical Genetics",
  clinicalOwner: "Dr. L. Haddad",
};

describe("patient letter", () => {
  const letter = composePatientLetter(input);

  it("fills the English draft from the record", () => {
    expect(letter.english).toContain("VP-10247");
    expect(letter.english).toContain("In March 2023 you had a genetic test");
    expect(letter.english).toContain("a gene called BRCA1");
    expect(letter.english).toContain("Your DNA has not changed.");
    expect(letter.english).toContain("follow-up appointment with the Clinical Genetics team");
    expect(letter.english.endsWith("Dr. L. Haddad\nClinical Genetics")).toBe(true);
  });

  it("fills the Arabic draft from the same record", () => {
    expect(letter.arabic).toContain("VP-10247");
    expect(letter.arabic).toContain("مارس 2023");
    expect(letter.arabic).toContain("BRCA1");
    expect(letter.arabic).toContain("لم يتغيّر حمضكم النووي");
    expect(letter.arabic.endsWith("Dr. L. Haddad\nقسم الوراثة السريرية")).toBe(true);
  });

  it("states no diagnosis, risk figure or classification", () => {
    for (const text of [letter.english, letter.arabic]) {
      expect(text).not.toMatch(
        /diagnos|risk|%|percent|pathogenic|benign|uncertain significance|\bVUS\b|variant/i,
      );
    }
  });

  it("stays within the word guide, with an Arabic department, for every record", () => {
    for (const patient of PATIENTS) {
      const drafted = composePatientLetter({
        caseId: "VP-R-2026-001",
        recordId: patient.id,
        gene: VARIANT_BY_KEY.get(patient.variantKey)?.gene ?? "GENE",
        testedOn: patient.testedOn,
        department: patient.orderingDepartment,
        clinicalOwner: patient.clinicalOwner,
      });
      expect(countWords(drafted.english)).toBeLessThanOrEqual(LETTER_WORD_LIMIT);
      expect(countWords(drafted.arabic)).toBeLessThanOrEqual(LETTER_WORD_LIMIT);
      expect(arabicDepartment(patient.orderingDepartment)).not.toBe(patient.orderingDepartment);
    }
  });

  it("heads the file with the draft notice and carries both languages", () => {
    const text = letterFileText(input, letter);
    expect(text.startsWith(LETTER_DRAFT_NOTE.toUpperCase())).toBe(true);
    expect(text).toContain(letter.english);
    expect(text).toContain(letter.arabic);
  });

  it("falls back to the English department name when no Arabic one is held", () => {
    expect(arabicDepartment("Dermatology")).toBe("Dermatology");
  });
});

describe("checking a reworded letter", () => {
  const letter = composePatientLetter(input);
  const reply = (english: string, arabic = letter.arabic) =>
    `=== ENGLISH ===\n${english}\n=== ARABIC ===\n${arabic}`;

  it("accepts the template's own wording", () => {
    expect(parseImprovedLetter(reply(letter.english), input)).toEqual(letter);
  });

  it("rejects a reply without both languages", () => {
    expect(parseImprovedLetter(letter.english, input)).toBeNull();
    expect(parseImprovedLetter(`=== ENGLISH ===\n${letter.english}`, input)).toBeNull();
  });

  it("rejects a risk figure, a lost fact or a letter over the limit", () => {
    expect(parseImprovedLetter(reply(`${letter.english}\n\nYour risk is 60%.`), input)).toBeNull();
    expect(parseImprovedLetter(reply(letter.english.replace("Dr. L. Haddad", "Your doctor")), input)).toBeNull();
    expect(parseImprovedLetter(reply(`${letter.english}\n\n${"word ".repeat(60)}`), input)).toBeNull();
    expect(
      parseImprovedLetter(reply(letter.english, letter.arabic.replaceAll("قسم الوراثة السريرية", "القسم")), input),
    ).toBeNull();
  });
});
