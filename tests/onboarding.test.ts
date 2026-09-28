import { describe, expect, it } from "vitest";

import { SAMPLE_CSV } from "@/data/onboarding-sample";
import { analyseWorkspace } from "@/lib/analysis";
import { normaliseHgvs } from "@/lib/hgvs";
import {
  IMPORT_COLUMNS,
  importImpact,
  importTemplate,
  parseDelimited,
  reportCsv,
  validateImport,
} from "@/lib/onboarding";

const TODAY = "2026-09-28";
const HEADER = IMPORT_COLUMNS.map((c) => c.key).join(",");
const GOOD = "PX-1,BRCA1,c.5056C>T,NM_007294.4,531444,Uncertain significance,2023-05-18,GRCh38,Clinical Genetics,Dr. L. Haddad";

const validate = (...rows: string[]) => validateImport([HEADER, ...rows].join("\n"), { today: TODAY });
const messages = (text: string) => validate(text).rows[0].issues.map((i) => `${i.severity}: ${i.message}`);

describe("parsing", () => {
  it("reads quoted fields, doubled quotes, CRLF, a BOM and other delimiters", () => {
    expect(parseDelimited('﻿a,b\r\n"x, y","say ""hi"""\r\n').rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
    expect(parseDelimited("a;b\n1;2").delimiter).toBe(";");
    expect(parseDelimited("a\tb\n1\t2").rows[1]).toEqual(["1", "2"]);
  });

  it("maps common header aliases onto the template's columns", () => {
    const report = validateImport(
      "Patient Ref,Gene Symbol,HGVS,Significance,Test Date,Assembly\nPX-1,BRCA1,c.5056C>T,VUS,2023-05-18,hg38",
      { today: TODAY },
    );
    expect(report.fileErrors).toEqual([]);
    expect(report.rows[0].status).toBe("accepted");
    expect(report.rows[0].match).toMatchObject({ status: "matched", variantKey: "BRCA1:c.5056C>T", basis: "HGVS only" });
  });

  it("rejects the whole file when a required column is missing", () => {
    const report = validateImport("record_id,gene\nPX-1,BRCA1", { today: TODAY });
    expect(report.rows).toEqual([]);
    expect(report.fileErrors[0]).toMatch(/Missing required columns: HGVS \(c\.\), Reported classification, Report date, Genome build/);
  });
});

describe("row checks", () => {
  it("accepts a clean row matched on HGVS and ClinVar ID", () => {
    const row = validate(GOOD).rows[0];
    expect(row.status).toBe("accepted");
    expect(row.issues).toEqual([]);
    expect(row.match.basis).toBe("HGVS and ClinVar ID agree");
  });

  it("never accepts a national ID, contact details or a name as the record key", () => {
    for (const key of ["784-1990-1234567-1", "784199012345671", "someone@example.com", "+971501234567", "Aisha Rahman"]) {
      const report = validate(GOOD.replace("PX-1", key));
      expect(report.rows[0].status, key).toBe("rejected");
    }
  });

  it("rejects identifiers that disagree, in either direction", () => {
    expect(messages(GOOD.replace("c.5056C>T", "c.5065C>T"))).toContain(
      "error: Identifiers disagree: ClinVar 531444 is BRCA1 c.5056C>T, but this row says BRCA1 c.5065C>T.",
    );
    expect(messages(GOOD.replace("531444", "999999"))).toContain(
      "error: Identifiers disagree: BRCA1 c.5056C>T is ClinVar 531444, but this row gives 999999.",
    );
  });

  it("warns on GRCh37 and on a different transcript version, and rejects a different transcript", () => {
    expect(validate(GOOD.replace("GRCh38", "GRCh37")).rows[0].status).toBe("warnings");
    expect(messages(GOOD.replace("NM_007294.4", "NM_007294.3"))[0]).toMatch(/^warning: Transcript NM_007294.3 is a different version/);
    expect(validate(GOOD.replace("NM_007294.4", "NM_000059.4")).rows[0].status).toBe("rejected");
  });

  it("rejects protein notation, unknown classifications, missing and future dates", () => {
    expect(validate(GOOD.replace("c.5056C>T", "p.His1686Tyr")).rows[0].status).toBe("rejected");
    expect(validate(GOOD.replace("Uncertain significance", "Probably fine")).rows[0].status).toBe("rejected");
    expect(validate(GOOD.replace("2023-05-18", "")).rows[0].status).toBe("rejected");
    expect(validate(GOOD.replace("2023-05-18", "2026-12-01")).rows[0].status).toBe("rejected");
    expect(validate(GOOD.replace("2023-05-18", "2023-02-30")).rows[0].status).toBe("rejected");
  });

  it("reads a day-first date with a warning rather than guessing silently", () => {
    const row = validate(GOOD.replace("2023-05-18", "14/02/2023")).rows[0];
    expect(row.reportDate).toBe("2023-02-14");
    expect(row.status).toBe("warnings");
  });

  it("normalises case and an inline transcript, and says it did", () => {
    const row = validate("PX-1,brca1,NM_007294.4:c.5056c>t,,,VUS,2023-05-18,GRCh38,,").rows[0];
    expect(row.gene).toBe("BRCA1");
    expect(row.hgvs).toBe("c.5056C>T");
    expect(row.transcript).toBe("NM_007294.4");
    expect(row.match.status).toBe("matched");
    expect(row.status).toBe("warnings");
  });

  it("holds an unmonitored variant as unmatched, not rejected", () => {
    const row = validate("PX-1,MLH1,c.350C>T,NM_000249.4,,VUS,2023-05-18,GRCh38,,").rows[0];
    expect(row.status).toBe("warnings");
    expect(row.match.status).toBe("unmatched");
  });

  it("rejects a duplicate of an earlier row", () => {
    const report = validate(GOOD, GOOD);
    expect(report.rows.map((r) => r.status)).toEqual(["accepted", "rejected"]);
    expect(report.totals.duplicates).toBe(1);
  });
});

describe("what a real extract throws at it", () => {
  it("rejects a row whose unquoted comma shifts its fields, instead of misreading it", () => {
    const shifted = GOOD.replace("Clinical Genetics,Dr. L. Haddad", "Oncology, Adult,Dr. R. Okonjo");
    const row = validate(shifted).rows[0];
    expect(row.status).toBe("rejected");
    expect(row.issues.map((i) => i.message).join(" ")).toMatch(/11 values but the header has 10/);
    // A trailing empty field is harmless.
    expect(validate(`${GOOD},`).rows[0].status).toBe("accepted");
  });

  it("numbers issues by the line a person would find in their editor", () => {
    const report = validateImport([HEADER, GOOD, ",,,,,,,,,", "", GOOD.replace("PX-1", "PX-2"), GOOD].join("\n"), {
      today: TODAY,
    });
    expect(report.rows.map((r) => r.line)).toEqual([2, 5, 6]);
    expect(report.rows[2].issues.map((i) => i.message)).toContain(
      "Duplicate of line 2: the same record with the same variant.",
    );
  });

  it("detects the delimiter from the first line that has content", () => {
    const text = ["", HEADER.replaceAll(",", ";"), GOOD.replaceAll(",", ";")].join("\n");
    const report = validateImport(text, { today: TODAY });
    expect(report.delimiter).toBe(";");
    expect(report.rows[0]).toMatchObject({ status: "accepted", line: 3 });
  });

  it("reads legal older notation, patch builds and versioned accessions", () => {
    const dup = validate("PX-1,BRCA1,c.1140dupG,NM_007294.4,231732,Pathogenic,2022-10-03,GRCh38.p14,,").rows[0];
    expect(dup.hgvs).toBe("c.1140dup");
    expect(dup.build).toBe("GRCh38");
    expect(dup.match).toMatchObject({ status: "matched", variantKey: "BRCA1:c.1140dup" });

    const versioned = validate(GOOD.replace("531444", "VCV000531444.5")).rows[0];
    expect(versioned.clinvarId).toBe("531444");
    expect(versioned.match.basis).toBe("HGVS and ClinVar ID agree");
  });

  it("does not mistake a zero-padded record key for a phone number", () => {
    expect(validate(GOOD.replace("PX-1", "0001234567")).rows[0].status).toBe("accepted");
    expect(validate(GOOD.replace("PX-1", "0501234567")).rows[0].status).toBe("warnings");
  });
});

describe("HGVS normalisation", () => {
  it("only canonicalises; it never invents a variant", () => {
    expect(normaliseHgvs("c.776delinstt").value).toBe("c.776delinsTT");
    expect(normaliseHgvs("c.68_69delAG").value).toBe("c.68_69del");
    expect(normaliseHgvs("c.5946delt")).toMatchObject({ value: "c.5946del", valid: true });
    expect(normaliseHgvs("5056C>T")).toMatchObject({ value: "c.5056C>T", valid: true });
    expect(normaliseHgvs("NM_007294.4(BRCA1):c.5056C>T")).toMatchObject({
      value: "c.5056C>T",
      transcript: "NM_007294.4",
      gene: "BRCA1",
    });
    expect(normaliseHgvs("c.5056C>").valid).toBe(false);
  });
});

describe("the sample extract", () => {
  it("produces the report its seeded problems should", () => {
    const report = validateImport(SAMPLE_CSV, { today: TODAY });
    expect(report.totals).toEqual({
      rows: 16,
      accepted: 3,
      withWarnings: 6,
      rejected: 7,
      matched: 8,
      unmatched: 1,
      conflicts: 1,
      duplicates: 1,
      grch37: 1,
    });
  });

  it("maps its accepted rows onto the cases they would join", async () => {
    const analysis = await analyseWorkspace({ mode: "demo" });
    const impact = importImpact(validateImport(SAMPLE_CSV, { today: TODAY }), analysis.assessments);
    const brca1 = impact.find((group) => group.variantKey === "BRCA1:c.5056C>T");
    expect(brca1?.rows.map((r) => r.recordId)).toEqual(["PX-20011", "PX-20024", "VP-10247"]);
    expect(brca1?.caseId).toBe(analysis.assessments.find((a) => a.variant.key === "BRCA1:c.5056C>T")?.caseId);
    expect(brca1?.rows.every((r) => r.change === "CLASSIFICATION_DRIFT")).toBe(true);
    expect(impact.flatMap((g) => g.rows).length).toBe(8);
  });

  it("round-trips the template and writes one report line per issue", () => {
    const template = validateImport(importTemplate(), { today: TODAY });
    expect(template.rows[0].status).toBe("accepted");
    const csv = reportCsv(validateImport(SAMPLE_CSV, { today: TODAY }));
    expect(csv.split("\r\n")[0]).toBe("line,record_id,status,match,severity,field,message");
    expect(csv).toContain("Looks like an Emirates ID");
  });
});
