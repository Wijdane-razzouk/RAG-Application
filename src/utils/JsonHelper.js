/**
 * Centralized helper for robust AI response parsing.
 * Specifically deals with LLMs that append text before or after the JSON block.
 */

function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

function escapeUnescapedQuotes(input) {
    let out = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (inString) {
            if (escaped) {
                out += ch;
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                out += ch;
                escaped = true;
                continue;
            }
            if (ch === "\"") {
                let j = i + 1;
                while (j < input.length && /\s/.test(input[j])) j++;
                const next = input[j];
                if (next === "," || next === "}" || next === "]" || next === ":") {
                    out += ch;
                    inString = false;
                } else {
                    out += "\\\"";
                }
                continue;
            }
            out += ch;
            continue;
        }

        if (ch === "\"") {
            inString = true;
        }
        out += ch;
    }

    return out;
}

function tryRepairParse(value) {
    const fixed = escapeUnescapedQuotes(value)
        .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*?)'/g, ':"$1"')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/}\s*{/g, "}, {");

    return tryParseJson(fixed);
}

function recoverJsonArrayItems(text) {
    const items = [];
    const startIdx = text.indexOf("[");
    if (startIdx === -1) return items;

    let inString = false;
    let escaped = false;
    let depth = 0;
    let start = -1;

    for (let i = startIdx; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === "\"") {
                inString = false;
            }
            continue;
        }

        if (ch === "\"") {
            inString = true;
            continue;
        }

        if (ch === "{") {
            if (depth === 0) start = i;
            depth++;
            continue;
        }

        if (ch === "}") {
            if (depth > 0) depth--;
            if (depth === 0 && start !== -1) {
                const chunk = text.substring(start, i + 1);
                const parsed = tryParseJson(chunk) || tryRepairParse(chunk);
                if (parsed) items.push(parsed);
                start = -1;
            }
        }
    }

    return items;
}

export function extractJson(content) {
    if (!content) return null;

    const sanitized = content
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .trim();

    const direct = tryParseJson(sanitized);
    if (direct) return direct;

    // 2. Heuristic search: Find all potential JSON boundaries
    const starts = [];
    const ends = [];
    for (let i = 0; i < sanitized.length; i++) {
        if (sanitized[i] === '[' || sanitized[i] === '{') starts.push(i);
        if (sanitized[i] === ']' || sanitized[i] === '}') ends.push(i);
    }

    const candidates = [];
    for (let s of starts) {
        for (let e of ends) {
            if (e > s) {
                const charS = sanitized[s];
                const charE = sanitized[e];
                // Match brackets or braces
                if ((charS === '[' && charE === ']') || (charS === '{' && charE === '}')) {
                    candidates.push({ s, e, len: e - s });
                }
            }
        }
    }

    // Sort by length descending - try biggest blocks first
    candidates.sort((a, b) => b.len - a.len);

    // Limit candidates to avoid infinite loop or performance hits on huge junk strings
    const topCandidates = candidates.slice(0, 50);

    for (let cand of topCandidates) {
        const chunk = sanitized.substring(cand.s, cand.e + 1);
        const parsed = tryParseJson(chunk) || tryRepairParse(chunk);
        if (parsed) return parsed;
    }

    // 3. Fallback: Recover any complete objects from a truncated array
    const recoveredItems = recoverJsonArrayItems(sanitized);
    if (recoveredItems.length > 0) return recoveredItems;

    // 4. Last resort: Truncated Array Recovery
    // If it starts with [ but doesn't have a matching ], try to close it at the last }
    if (sanitized.startsWith("[")) {
        const lastBrace = sanitized.lastIndexOf("}");
        if (lastBrace > 0) {
            const potentialJson = sanitized.substring(0, lastBrace + 1) + "]";
            const parsed = tryParseJson(potentialJson) || tryRepairParse(potentialJson);
            if (parsed) return parsed;
            console.error("Truncated recovery failed.");
        }
    }

    console.error("extractJson: Failed all heuristic attempts for content:", content.substring(0, 100) + "...");
    return null;
}
