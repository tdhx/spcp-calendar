import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addDays,
  addMonths,
  eventsInRange,
  monthGrid,
  rangeWithinCoverage,
  startOfSundayWeek,
  liturgicalColour,
  matchesEvent,
  orderedEventTypes,
  presiderGroups,
  validateFeed,
} from "../web/calendar-core.js";

const feed = JSON.parse(await readFile(new URL("../feeds/v1/calendar.json", import.meta.url)));
const parishFeed = JSON.parse(await readFile(new URL("../feeds/v1/parish.json", import.meta.url)));
const parishRegistry = JSON.parse(
  await readFile(new URL("../feeds/v1/parishes.json", import.meta.url)),
);
const southportFeed = JSON.parse(
  await readFile(new URL("../feeds/v1/southport/calendar.json", import.meta.url)),
);
const southportParishFeed = JSON.parse(
  await readFile(new URL("../feeds/v1/southport/parish.json", import.meta.url)),
);
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const diagnosticsSource = await readFile(
  new URL("../diagnostics.html", import.meta.url),
  "utf8",
);
const stylesSource = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("published feed validates", () => {
  assert.equal(validateFeed(feed), feed);
});

test("published parish feed has the versioned about-page contract", () => {
  assert.equal(parishFeed.schema_version, 1);
  assert.equal(parishFeed.id, "surfers-paradise");
  assert.equal(parishFeed.churches.length, 3);
  assert.equal(parishFeed.churches.filter((church) => church.is_primary_site).length, 1);
});

test("published parish registry exposes SPCP and Southport only", () => {
  assert.equal(parishRegistry.schema_version, 1);
  assert.equal(parishRegistry.default_parish, "surfers-paradise");
  assert.deepEqual(
    parishRegistry.parishes.map((parish) => parish.id),
    ["surfers-paradise", "southport"],
  );
  assert.doesNotMatch(JSON.stringify(parishRegistry), /pilgrim/i);
});

test("published Southport feeds validate", () => {
  assert.equal(validateFeed(southportFeed), southportFeed);
  assert.equal(southportParishFeed.id, "southport");
  assert.equal(southportParishFeed.churches.length, 4);
  assert.equal(
    southportParishFeed.churches.filter((location) => location.location_type === "chaplaincy").length,
    1,
  );
  assert.ok(southportFeed.events.some((event) => event.event_subtype === "filipino"));
  assert.ok(southportFeed.events.some((event) => event.event_subtype === "korean"));
  assert.ok(southportFeed.events.some((event) => event.event_type === "adoration"));
  assert.ok(southportFeed.events.some((event) => event.event_type === "novena"));
});

test("default filters match Masses and Reconciliation", () => {
  const selected = {
    eventType: new Set(),
    multiculturalSubtype: new Set(),
    church: new Set(),
    presider: new Set(),
  };
  const results = feed.events.filter((event) => (
    matchesEvent(event, selected, "", ["mass", "confession"])
  ));
  assert.ok(results.length > 0);
  assert.ok(results.every((event) => ["mass", "confession"].includes(event.event_type)));
});

test("explicit event selections override the default feed view", () => {
  const selected = {
    eventType: new Set(["baptism"]),
    multiculturalSubtype: new Set(),
    church: new Set(),
    presider: new Set(),
  };
  const results = feed.events.filter((event) => (
    matchesEvent(event, selected, "", ["mass", "confession"])
  ));
  assert.ok(results.length > 0);
  assert.ok(results.every((event) => event.event_type === "baptism"));
});

test("search includes joined liturgical fields", () => {
  const event = feed.events.find((candidate) => candidate.liturgical?.observance);
  assert.ok(event);
  const selected = {
    eventType: new Set(),
    multiculturalSubtype: new Set(),
    church: new Set(),
    presider: new Set(),
  };
  assert.equal(
    matchesEvent(event, selected, event.liturgical.observance.toLocaleLowerCase()),
    true,
  );
});

test("card accents use known liturgical colours with a parish fallback", () => {
  assert.equal(
    liturgicalColour({ liturgical: { liturgical_colour: "RED" } }),
    "red",
  );
  assert.equal(liturgicalColour({ liturgical: null }), "parish");
  assert.equal(
    liturgicalColour({ liturgical: { liturgical_colour: "gold" } }),
    "parish",
  );
});

test("published module URLs use matching cache-busting revisions", () => {
  assert.match(indexSource, /src="app\.js\?v=34"/);
  assert.match(appSource, /calendar-core\.js\?v=5/);
});

test("header navigation switches between calendar and feed-driven parish views", () => {
  assert.match(indexSource, /id="site-navigation"[\s\S]*?data-page="calendar"/);
  assert.match(indexSource, /data-page="about"[\s\S]*?>About the Parish</);
  assert.match(indexSource, /id="about-page"[\s\S]*?id="parish-churches"/);
  assert.match(appSource, /const PARISH_REGISTRY_URL = "feeds\/v1\/parishes\.json"/);
  assert.match(appSource, /function renderParish\(parish\)/);
  assert.match(appSource, /window\.location\.hash === "#about"/);
});

test("header parish selector switches registered feeds and persists URL state", () => {
  assert.match(indexSource, /id="parish-selector-toggle"[\s\S]*?aria-controls="parish-selector"/);
  assert.match(indexSource, /class="parish-selector-chevron"/);
  assert.match(appSource, /function selectParish\(parishId, updateUrl = true\)/);
  assert.match(appSource, /url\.searchParams\.set\("parish", parishId\)/);
  assert.match(appSource, /localStorage\.setItem\(PARISH_STORAGE_KEY, parish\.id\)/);
  assert.match(appSource, /loadEvents\(parish\.calendar_feed, parish\.id\)/);
  assert.match(appSource, /loadParish\(parish\.parish_feed, parish\.id\)/);
  assert.match(stylesSource, /\.parish-selector-toggle \{/);
  assert.match(stylesSource, /\.parish-selector \{/);
});

test("mobile navigation uses a hamburger-controlled dropdown", () => {
  assert.match(indexSource, /id="navigation-toggle"[\s\S]*?aria-controls="site-navigation"/);
  assert.equal((indexSource.match(/<span aria-hidden="true"><\/span>/g) || []).length, 3);
  assert.match(stylesSource, /@media \(max-width: 800px\)[\s\S]*?\.navigation-toggle \{[\s\S]*?display: grid/);
  assert.match(stylesSource, /\.site-navigation\.navigation-open \{[\s\S]*?display: grid/);
  assert.match(appSource, /classList\.toggle\("navigation-open", !expanded\)/);
});

test("past events are timestamped, muted, and refreshed against the current time", () => {
  assert.match(appSource, /function eventHasEnded\(event, now = Date\.now\(\)\)/);
  assert.match(appSource, /card\.dataset\.eventEnd = String\(new Date\(event\.end\)\.getTime\(\)\)/);
  assert.match(appSource, /summary\.dataset\.eventEnd = String\(new Date\(event\.end\)\.getTime\(\)\)/);
  assert.match(appSource, /window\.setInterval\(updatePastStates, 30_000\)/);
  assert.match(stylesSource, /\.event-card\.is-past \{/);
  assert.match(stylesSource, /\.month-event\.is-past \{/);
});

test("event cards rely on grouped date headings", () => {
  assert.doesNotMatch(indexSource, /class="event-date"/);
  assert.match(appSource, /className = "week-footer-navigation"/);
  assert.match(appSource, /function weekIntersectsCoverage/);
});

test("weekly view is selected by default", () => {
  assert.match(appSource, /view: "weekly"/);
  assert.match(
    indexSource,
    /id="view-weekly"[\s\S]*?aria-selected="true"[\s\S]*?tabindex="0"/,
  );
  assert.match(indexSource, /aria-labelledby="view-weekly"/);
});

test("feed diagnostics live on a separate page", () => {
  assert.doesNotMatch(indexSource, /id="diagnostics"/);
  assert.doesNotMatch(appSource, /renderDiagnostics/);
  assert.match(indexSource, /href="diagnostics\.html\?parish=surfers-paradise"/);
  assert.match(diagnosticsSource, /src="diagnostics\.js\?v=2"/);
});

test("desktop settings remain in the left sidebar", () => {
  assert.match(stylesSource, /\.page-shell \{[\s\S]*?grid-template-columns: 310px minmax\(0, 1fr\)/);
  assert.match(stylesSource, /\.filters \{[\s\S]*?position: sticky/);
  assert.match(stylesSource, /\.filters \{[\s\S]*?top: calc\(var\(--page-header-height/);
  assert.match(stylesSource, /\.settings-view \.view-switcher \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(appSource, /if \(!isMobileLayout\(\)\)[\s\S]*?filters\.classList\.remove\("filters-collapsed"\)/);
});

test("mobile settings use the results bar and a full-screen panel", () => {
  assert.match(indexSource, /id="filters-toggle"[\s\S]*?aria-controls="filters"/);
  assert.match(indexSource, /class="settings-icon"/);
  assert.match(indexSource, /id="results-today"[\s\S]*?>Today</);
  assert.equal((indexSource.match(/data-show-all/g) || []).length, 2);
  assert.equal((indexSource.match(/Clear filters/g) || []).length, 2);
  assert.doesNotMatch(indexSource, /id="search"/);
  assert.match(stylesSource, /@media \(max-width: 800px\)[\s\S]*?\.filters \{[\s\S]*?inset: 0/);
  assert.match(stylesSource, /@media \(max-width: 800px\)[\s\S]*?\.filters \{[\s\S]*?max-height: 100dvh/);
});

test("mobile view changes are staged until settings close", () => {
  assert.match(appSource, /pendingView: null/);
  assert.match(appSource, /settingsScrollY: null/);
  assert.match(
    appSource,
    /if \(isMobileLayout\(\) && elements\.filtersToggle[\s\S]*?state\.pendingView = view;[\s\S]*?return;/,
  );
  assert.match(appSource, /const changed = pendingView && pendingView !== state\.view;[\s\S]*?applyView\(pendingView/);
  assert.match(appSource, /const openingScrollY = expanded \? window\.scrollY : null/);
  assert.match(appSource, /state\.settingsScrollY = openingScrollY/);
  assert.match(appSource, /document\.body\.style\.top = `-\$\{openingScrollY\}px`/);
});

test("desktop and mobile period navigation use separate layouts", () => {
  assert.equal((indexSource.match(/data-period-control="previous"/g) || []).length, 2);
  assert.equal((indexSource.match(/data-period-control="next"/g) || []).length, 2);
  assert.match(indexSource, /desktop-period-navigation/);
  assert.match(indexSource, /mobile-period-navigation/);
  assert.match(stylesSource, /\.desktop-period-navigation \{[\s\S]*?background: transparent/);
  assert.match(stylesSource, /\.mobile-period-navigation \{[\s\S]*?justify-content: space-between/);
});

test("filter labels and reconciliation accents use the requested wording and colour", () => {
  assert.match(appSource, /multicultural: "Multicultural Masses"/);
  assert.match(appSource, /confession: "violet"/);
  assert.match(appSource, /rosary: "red"/);
  assert.match(appSource, /novena: "gold"/);
  assert.match(appSource, /card\.dataset\.liturgicalColour = eventAccentColour\(event\)/);
  assert.match(appSource, /summary\.dataset\.liturgicalColour = eventAccentColour\(event\)/);
  assert.match(stylesSource, /\.event-card\[data-liturgical-colour="gold"\]/);
  assert.match(stylesSource, /\.month-event\[data-liturgical-colour="gold"\]/);
});

test("view changes use conditional scrolling and monthly does not jump", () => {
  assert.match(appSource, /function applyView\(view, previousScrollY = window\.scrollY\)/);
  assert.match(appSource, /requiredDocumentHeight = previousScrollY \+ window\.innerHeight/);
  assert.match(appSource, /elements\.events\.style\.minHeight = `\$\{eventsHeight \+ heightDeficit\}px`/);
  assert.match(appSource, /window\.scrollTo\(\{ top: previousScrollY/);
  assert.match(appSource, /const upperThird = window\.innerHeight \/ 3/);
  assert.match(appSource, /const lowerThird = window\.innerHeight \* \(2 \/ 3\)/);
  assert.match(appSource, /requestAnimationFrame\(scrollToCurrentDay\)/);
});

test("weekly navigation scrolls to the navigation row", () => {
  assert.match(
    appSource,
    /state\.view === "weekly"[\s\S]*?document\.querySelector\("\.calendar-toolbar"\)/,
  );
  assert.match(appSource, /navigatePeriod\("previous", isMobileLayout\(\)\)/);
  assert.match(appSource, /navigatePeriod\("next", isMobileLayout\(\)\)/);
});

test("multicultural mass options start collapsed", () => {
  assert.match(appSource, /toggle\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(appSource, /children\.hidden = true/);
});

test("daily view is progressively loaded and period navigation omits Today", () => {
  assert.match(appSource, /dailyDaysVisible: 7/);
  assert.match(appSource, /state\.dailyDaysVisible = displayedDays \+ 14/);
  assert.match(appSource, /function dailyRangeEnd\(events, start, minimumEvents = 10\)/);
  assert.match(appSource, /eventsInRange\(events, start, end\)\.length < minimumEvents/);
  assert.match(appSource, /Load more/);
  assert.doesNotMatch(indexSource, /id="today-period"/);
});

test("unknown presiders are omitted and empty filter categories are hidden", () => {
  assert.doesNotMatch(appSource, /Presider TBA/);
  assert.match(appSource, /presider\.hidden = !presider\.textContent/);
  assert.match(
    appSource,
    /presiderFilters\.closest\("\.filter-section"\)\.hidden = presiders\.length === 0/,
  );
});

test("unknown Mass locations use the supplied fallback artwork", () => {
  assert.match(appSource, /card\.classList\.add\("event-mass-fallback"\)/);
  assert.match(stylesSource, /\.event-mass-fallback \{[\s\S]*?assets\/mass-fallback\.jpg/);
  assert.match(stylesSource, /\.event-mass-fallback::before \{[\s\S]*?background-size: 58% auto/);
});

test("calendar result bars inherit the active parish theme", () => {
  assert.match(
    stylesSource,
    /body\[data-theme="spcp"\][\s\S]*?--theme-bar-gradient: linear-gradient/,
  );
  assert.match(
    stylesSource,
    /body\[data-theme="southport"\][\s\S]*?--theme-bar-gradient: linear-gradient/,
  );
  assert.match(stylesSource, /\.results-header \{[\s\S]*?background: var\(--theme-bar-gradient\)/);
  assert.match(stylesSource, /#results-context \{[\s\S]*?color: var\(--theme-bar-context\)/);
});

test("multicultural presiders select their associated Mass filters", () => {
  assert.match(appSource, /\["Fr Fadi", \["maronite"\]\]/);
  assert.match(appSource, /\["Fr Jerzy", \["polish"\]\]/);
  assert.match(appSource, /\["Fr Luis", \["hispanic", "italian"\]\]/);
  assert.match(appSource, /selectMulticulturalPresider\(state\.selected, value\)/);
});

test("filter options use the requested display order", () => {
  assert.deepEqual(
    orderedEventTypes(["multicultural", "baptism", "mass", "confession"]),
    ["mass", "confession", "baptism", "multicultural"],
  );
  assert.deepEqual(
    presiderGroups([
      "Fr Luis",
      "Fr Warren",
      "Fr Bradley",
      "Fr Damian",
      "Fr Fadi",
      "Fr John",
      "Fr Paul",
    ]),
    [
      ["Fr Paul", "Fr Bradley"],
      ["Fr Damian", "Fr John", "Fr Warren"],
      ["Fr Fadi", "Fr Luis"],
    ],
  );
});

test("calendar helpers use Sunday week boundaries", () => {
  assert.equal(startOfSundayWeek("2026-06-10"), "2026-06-07");
  assert.equal(startOfSundayWeek("2026-06-14"), "2026-06-14");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("month grids align to complete Sunday-first weeks", () => {
  const february = monthGrid("2024-02-14");
  assert.equal(february[0], "2024-01-28");
  assert.equal(february.at(-1), "2024-03-02");
  assert.equal(february.length, 35);

  const august = monthGrid("2026-08-20");
  assert.equal(august[0], "2026-07-26");
  assert.equal(august.at(-1), "2026-09-05");
  assert.equal(august.length, 42);
  assert.equal(addMonths("2026-12-15", 1), "2027-01-01");
});

test("events can be selected by inclusive date-key range", () => {
  const events = [
    { start: "2026-06-13T17:00:00+10:00" },
    { start: "2026-06-14T07:00:00+10:00" },
    { start: "2026-06-21" },
  ];
  assert.deepEqual(
    eventsInRange(events, "2026-06-14", "2026-06-20"),
    [events[1]],
  );
});

test("navigation requires complete ranges inside feed coverage", () => {
  const coverage = { start: "2026-06-10", end: "2026-09-09" };
  assert.equal(rangeWithinCoverage("2026-06-14", "2026-06-20", coverage), true);
  assert.equal(rangeWithinCoverage("2026-06-07", "2026-06-13", coverage), false);
  assert.equal(rangeWithinCoverage("2026-09-06", "2026-09-12", coverage), false);
});
