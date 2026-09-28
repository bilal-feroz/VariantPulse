/**
 * A synthetic partner extract for demonstrating the import report.
 *
 * Every record key, date, clinician and department is fabricated, and the file
 * is seeded with the problems a real extract tends to carry, one per row where
 * possible, so the report has something to show: a GRCh37 row, identifiers
 * that disagree, a duplicate, a national-ID-shaped key, a variant that is not
 * monitored, protein notation in the coding column, an unrecognised
 * classification, a missing date, an older transcript version, a future date,
 * a day-first date, inconsistent casing and a record already on file.
 *
 * The Emirates-ID-shaped key is all zeros: the pattern, not an identifier.
 */

export const SAMPLE_FILE_NAME = "partner-extract-sample.csv";

export const SAMPLE_CSV = [
  "record_id,gene,hgvs_c,transcript,clinvar_id,classification,report_date,genome_build,department,clinical_owner",
  "PX-20011,BRCA1,c.5056C>T,NM_007294.4,531444,Uncertain significance,2023-05-18,GRCh38,Clinical Genetics,Dr. L. Haddad",
  "PX-20012,BRCA2,c.7847C>T,NM_000059.4,630829,VUS,2023-09-02,GRCh38,Oncology,Dr. R. Okonjo",
  "PX-20013,TP53,c.589G>A,NM_000546.6,188060,Uncertain significance,2022-11-30,GRCh37,Oncology,Dr. R. Okonjo",
  "PX-20014,BRCA1,c.5065C>T,NM_007294.4,531444,Uncertain significance,2023-02-10,GRCh38,Clinical Genetics,Dr. M. Suleiman",
  "PX-20015,LDLR,c.1381G>T,NM_000527.5,183113,uncertain significance,2023-07-07,hg38,Lipid Clinic,Dr. H. Nassar",
  "PX-20015,LDLR,c.1381G>T,NM_000527.5,183113,uncertain significance,2023-07-07,hg38,Lipid Clinic,Dr. H. Nassar",
  "784-0000-0000000-0,HBB,c.380T>G,NM_000518.5,15483,Pathogenic,2023-03-01,GRCh38,Haematology,Dr. F. Al Mazrouei",
  "PX-20017,MLH1,c.350C>T,NM_000249.4,,Uncertain significance,2023-04-19,GRCh38,Oncology,Dr. R. Okonjo",
  "PX-20018,CFTR,p.Val201Met,,54022,VUS,2023-06-12,GRCh38,Clinical Genetics,Dr. L. Haddad",
  "PX-20019,PTEN,c.149T>C,NM_000314.8,492727,Probably harmless,2023-01-09,GRCh38,Paediatric Genetics,Dr. S. Aziz",
  "PX-20020,MYBPC3,c.26-2A>G,NM_000256.3,42644,Pathogenic,,GRCh38,Cardiology,Dr. P. Varga",
  "PX-20021,BRCA2,c.9538C>T,NM_000059.3,52865,Uncertain significance,2023-08-14,GRCh38,Breast Surgery,Dr. N. Farouk",
  "PX-20022,TP53,c.784G>A,NM_000546.6,141228,Uncertain significance,2027-01-15,GRCh38,Oncology,Dr. R. Okonjo",
  "PX-20023,HBB,c.364G>C,NM_000518.5,15152,Conflicting interpretations of pathogenicity,14/02/2023,GRCh38,Haematology,Dr. F. Al Mazrouei",
  "PX-20024,brca1,NM_007294.4:c.5056c>t,,,VUS,2023-10-03,GRCh38,Breast Surgery,Dr. N. Farouk",
  "VP-10247,BRCA1,c.5056C>T,NM_007294.4,531444,Uncertain significance,2023-03-14,GRCh38,Clinical Genetics,Dr. L. Haddad",
].join("\r\n");

/** The reference-set template for the silent pilot: one row per monitored variant. */
export const REFERENCE_SET_HEADER = "variant,expected,reviewer,note";
