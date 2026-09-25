/**
 * Route QA sweep. Not part of the gates.
 *
 * Visits every route at desktop, tablet and mobile sizes against a running
 * server and reports console errors, hydration warnings, page errors, failed
 * requests, broken images, horizontal overflow, clipped elements and unnamed
 * controls.
 *
 *   npm run build && npm start &
 *   node scripts/qa-routes.mjs [--base http://localhost:3000] [--out qa-report] [--screenshots]
 *
 * Needs Playwright, which is not a project dependency. Install it anywhere and
 * point PLAYWRIGHT_MODULE at it, e.g.
 *   npm i --prefix ~/qa-tools playwright && npx --prefix ~/qa-tools playwright install chromium
 *   PLAYWRIGHT_MODULE=~/qa-tools/node_modules/playwright/index.mjs node scripts/qa-routes.mjs
 * Set QA_CDP=http://localhost:29229 to drive an existing Chrome over CDP instead.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = flag("base", "http://localhost:3000").replace(/\/$/, "");
const OUT = resolve(flag("out", "qa-report"));
const SCREENSHOTS = args.includes("--screenshots");

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath.replace(/^~/, process.env.HOME ?? "~")).href : "playwright"
);

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

const analysis = await (await fetch(`${BASE}/api/analysis`)).json();
const lead = analysis.assessments.find((a) => a.caseId) ?? analysis.assessments[0];
const patient = lead.impactedPatients[0];

const ROUTES = [
  "/",
  "/patients",
  `/patients/${patient.id}`,
  "/variants",
  `/variants/${encodeURIComponent(lead.variant.key)}`,
  "/evidence",
  "/regional",
  "/review",
  `/review/${lead.caseId}`,
  "/activity",
  "/sources",
  "/settings",
  "/this-route-does-not-exist",
];

const browser = process.env.QA_CDP
  ? await chromium.connectOverCDP(process.env.QA_CDP)
  : await chromium.launch();

mkdirSync(OUT, { recursive: true });
const results = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 1024,
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const issues = { console: [], pageErrors: [], failedRequests: [] };
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        issues.console.push(`${msg.type()}: ${msg.text().slice(0, 300)}`);
      }
    });
    page.on("pageerror", (err) => issues.pageErrors.push(String(err).slice(0, 300)));
    page.on("requestfailed", (req) =>
      issues.failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ""}`),
    );
    page.on("response", (res) => {
      if (res.status() >= 400 && res.url() !== `${BASE}${route}`) {
        issues.failedRequests.push(`${res.status()} ${res.url()}`);
      }
    });

    const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const dom = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const main = document.getElementById("workspace-content");
      const brokenImages = [...document.images]
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src);

      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 1 && rect.height > 1;
      };
      const clippedByAncestor = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(o.overflowX) && p !== document.body && p !== document.documentElement && p.id !== "workspace-content") return true;
        }
        return false;
      };
      const offscreen = [...document.querySelectorAll("body *")]
        .filter((el) => visible(el) && !clippedByAncestor(el))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > vw + 1 || r.left < -1;
        })
        .filter((el) => getComputedStyle(el).position !== "fixed")
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${[...el.classList].slice(0, 4).join(".")} (${Math.round(el.getBoundingClientRect().right)}px)`);

      const truncatedText = [...document.querySelectorAll("h1, h2, h3, button, a")]
        .filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 1 && !getComputedStyle(el).textOverflow.includes("ellipsis") && getComputedStyle(el).overflow !== "visible")
        .slice(0, 5)
        .map((el) => (el.textContent ?? "").trim().slice(0, 60));

      const unnamed = [...document.querySelectorAll("button, a[href], [role=button]")]
        .filter((el) => visible(el))
        .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("title") || (el.textContent ?? "").trim() || el.querySelector("img[alt]:not([alt=''])")))
        .slice(0, 5)
        .map((el) => el.outerHTML.slice(0, 120));

      const deadLinks = [...document.querySelectorAll("a")]
        .filter((a) => visible(a) && (!a.getAttribute("href") || a.getAttribute("href") === "#"))
        .map((a) => (a.textContent ?? "").trim().slice(0, 60));

      const text = document.body.innerText;
      const mode = /Demo snapshot|Evidence monitor live|Cached evidence/.exec(text)?.[0] ?? null;

      return {
        docOverflow: document.documentElement.scrollWidth - vw,
        mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
        brokenImages,
        offscreen,
        truncatedText,
        unnamed,
        deadLinks,
        mode,
      };
    });

    if (SCREENSHOTS) {
      const slug = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
      await page.screenshot({ path: resolve(OUT, `${viewport.name}__${slug}.png`), fullPage: false });
    }

    const hydration = issues.console.filter((m) => /hydrat|did not match|server rendered/i.test(m));
    results.push({
      viewport: viewport.name,
      route,
      status: response?.status() ?? 0,
      ...issues,
      hydration,
      ...dom,
    });
    await page.close();
  }
  await context.close();
}

await browser.close();

writeFileSync(resolve(OUT, "qa-results.json"), `${JSON.stringify(results, null, 2)}\n`);

const problems = (r) => {
  const out = [];
  const expected404 = r.route === "/this-route-does-not-exist";
  if (expected404 ? r.status !== 404 : r.status !== 200) out.push(`HTTP ${r.status}`);
  const consoleNoise = r.console.filter((m) => !(expected404 && /404/.test(m)));
  if (consoleNoise.length) out.push(`console: ${consoleNoise.join(" | ")}`);
  if (r.hydration.length) out.push("hydration warning");
  if (r.pageErrors.length) out.push(`page errors: ${r.pageErrors.join(" | ")}`);
  const failed = r.failedRequests.filter((f) => !/_rsc=|net::ERR_ABORTED/.test(f));
  if (failed.length) out.push(`failed requests: ${failed.join(" | ")}`);
  if (r.brokenImages.length) out.push(`broken images: ${r.brokenImages.join(", ")}`);
  if (r.docOverflow > 0 || r.mainOverflow > 0) out.push(`horizontal overflow doc=${r.docOverflow}px main=${r.mainOverflow}px`);
  if (r.offscreen.length) out.push(`off-screen: ${r.offscreen.join("; ")}`);
  if (r.truncatedText.length) out.push(`clipped text: ${r.truncatedText.join("; ")}`);
  if (r.unnamed.length) out.push(`unnamed controls: ${r.unnamed.length}`);
  if (r.deadLinks.length) out.push(`dead links: ${r.deadLinks.join(", ")}`);
  return out;
};

const lines = ["| Viewport | Route | Status | Mode shown | Findings |", "|---|---|---|---|---|"];
let failures = 0;
for (const r of results) {
  const p = problems(r);
  if (p.length) failures += 1;
  lines.push(`| ${r.viewport} | \`${r.route}\` | ${r.status} | ${r.mode ?? "—"} | ${p.length ? p.join("<br>") : "clean"} |`);
}
writeFileSync(resolve(OUT, "qa-results.md"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
console.log(`\n${results.length} checks, ${failures} with findings. Report in ${OUT}`);
