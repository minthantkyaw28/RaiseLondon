import type { Connection, IntroMatch, Person } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char ?? "";
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char ?? "";
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim()));
}

export function normalizeLinkedin(value: string | null | undefined): string | null {
  if (!value) return null;
  let path = value.trim().toLowerCase();
  if (!path) return null;
  path = path.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const at = path.indexOf("linkedin.com/");
  if (at === -1) {
    if (path.startsWith("linkedin.com")) {
      return path.split("?")[0]?.split("#")[0]?.replace(/\/+$/, "") ?? null;
    }
    return null;
  }
  path = path.slice(at);
  const cut = path.split("?")[0]?.split("#")[0]?.replace(/\/+$/, "");
  return cut || null;
}

export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseConnectionsCsv(text: string): Connection[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const name = cell.trim().toLowerCase();
      return name === "first name" || name === "name" || name === "linkedin" || name === "url";
    }),
  );
  if (headerIndex < 0) return [];
  const header = rows[headerIndex]?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const indexOf = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const first = indexOf("first name");
  const last = indexOf("last name");
  const full = indexOf("name", "full name");
  const url = indexOf("url", "linkedin", "linkedin url", "profile url");
  const company = indexOf("company", "organization");
  const connections: Connection[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const given = first >= 0 ? (row[first] ?? "") : "";
    const family = last >= 0 ? (row[last] ?? "") : "";
    const combined = [given, family].filter(Boolean).join(" ").trim();
    const name = combined || (full >= 0 ? (row[full] ?? "").trim() : "");
    if (!name) continue;
    connections.push({
      name,
      company: company >= 0 ? (row[company] ?? "").trim() || null : null,
      linkedin: url >= 0 ? (row[url] ?? "").trim() || null : null,
    });
  }
  return connections;
}

export function matchIntros(connections: Connection[], people: Person[]): IntroMatch[] {
  const byLinkedin = new Map<string, Person[]>();
  const byName = new Map<string, Person[]>();
  for (const person of people) {
    const linkedin = normalizeLinkedin(person.linkedin);
    if (linkedin) {
      const list = byLinkedin.get(linkedin) ?? [];
      list.push(person);
      byLinkedin.set(linkedin, list);
    }
    const name = normalizeName(person.name);
    if (name.includes(" ")) {
      const list = byName.get(name) ?? [];
      list.push(person);
      byName.set(name, list);
    }
  }

  const matches: IntroMatch[] = [];
  const seen = new Set<string>();
  for (const connection of connections) {
    const linkedin = normalizeLinkedin(connection.linkedin);
    const linked = linkedin ? byLinkedin.get(linkedin) : undefined;
    if (linked && linked.length > 0) {
      for (const person of linked) {
        const key = `${connection.name}:${person.id}:linkedin`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ connection, person, investorUuid: person.investorUuid, via: "linkedin" });
      }
      continue;
    }
    const name = normalizeName(connection.name);
    const named = name.includes(" ") ? byName.get(name) : undefined;
    if (named && named.length === 1) {
      const person = named[0];
      if (!person) continue;
      const key = `${connection.name}:${person.id}:name`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ connection, person, investorUuid: person.investorUuid, via: "name" });
    }
  }
  return matches;
}
