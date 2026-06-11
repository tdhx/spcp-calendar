const PARISH_REGISTRY_URL = "feeds/v1/parishes.json";

const title = document.querySelector("#diagnostics-title");
const body = document.querySelector("#diagnostics-body");
const errorMessage = document.querySelector("#diagnostics-error");
const logo = document.querySelector("#diagnostics-logo");
const backLink = document.querySelector(".back-link");

function appendList(headingText, values) {
  const heading = document.createElement("h3");
  heading.textContent = headingText;
  const list = document.createElement("ul");
  (values.length ? values : ["None"]).forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  body.append(heading, list);
}

async function loadDiagnostics() {
  try {
    const registryResponse = await fetch(PARISH_REGISTRY_URL, { cache: "no-store" });
    if (!registryResponse.ok) {
      throw new Error(`Parish registry returned ${registryResponse.status}.`);
    }
    const registry = await registryResponse.json();
    const requested = new URL(window.location.href).searchParams.get("parish");
    const parish = registry.parishes.find((candidate) => candidate.id === requested)
      || registry.parishes.find((candidate) => candidate.id === registry.default_parish);
    document.body.dataset.theme = parish.theme;
    document.title = `Feed Diagnostics · ${parish.short_name}`;
    logo.src = parish.logo;
    logo.alt = parish.name;
    backLink.href = `index.html?parish=${encodeURIComponent(parish.id)}`;

    const response = await fetch(parish.calendar_feed, { cache: "no-store" });
    if (!response.ok) throw new Error(`Calendar feed returned ${response.status}.`);
    const feed = await response.json();
    const generated = new Date(feed.generated_at);
    const ageHours = Math.max(0, (Date.now() - generated.getTime()) / 3_600_000);

    title.textContent = `Schema v${feed.schema_version} · ${ageHours.toFixed(1)}h old`;
    const facts = document.createElement("dl");
    [
      ["Generated", generated.toLocaleString("en-AU")],
      ["Coverage", `${feed.coverage.start} to ${feed.coverage.end}`],
      ["Timezone", feed.timezone],
      ["Events", String(feed.events.length)],
    ].forEach(([term, description]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = description;
      facts.append(dt, dd);
    });
    body.append(facts);

    appendList(
      "Sources",
      feed.sources.map((source) => `${source.name}: ${source.status}`),
    );
    appendList("Warnings", feed.warnings);

    const identifiers = document.createElement("details");
    identifiers.className = "source-identifiers";
    const summary = document.createElement("summary");
    summary.textContent = `Source identifiers (${feed.events.length})`;
    const list = document.createElement("ul");
    feed.events.forEach((event) => {
      const item = document.createElement("li");
      const id = document.createElement("code");
      const sourceId = document.createElement("code");
      id.textContent = event.id;
      sourceId.textContent = event.source_id;
      item.append(id, " · ", sourceId);
      list.append(item);
    });
    identifiers.append(summary, list);
    body.append(identifiers);
  } catch (error) {
    title.textContent = "Diagnostics unavailable";
    errorMessage.hidden = false;
    errorMessage.textContent = error.message;
  }
}

loadDiagnostics();
