/**
 * Centralized helper for robust AI response parsing.
 * Specifically deals with LLMs that append text before or after the JSON block.
 */

export function extractJson(content) {
    if (!content) return null;

    const sanitized = content
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .trim();

    try {
        // 1. Try direct parse
        return JSON.parse(sanitized);
    } catch (e) {
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
            try {
                const chunk = sanitized.substring(cand.s, cand.e + 1);
                return JSON.parse(chunk);
            } catch (err) {
                // Try to repair common JSON errors in this chunk
                try {
                    // Fix unquoted keys: { key: "value" } -> { "key": "value" }
                    // Fix single quoted keys: { 'key': "value" } -> { "key": "value" }
                    // Fix trailing commas: , } -> }
                    let fixed = sanitized.substring(cand.s, cand.e + 1)
                        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
                        .replace(/'/g, '"')
                        .replace(/,\s*}/g, "}")
                        .replace(/,\s*]/g, "]")
                        .replace(/}\s*{/g, "}, {");

                    return JSON.parse(fixed);
                } catch (e2) {
                    // Repair failed, continue
                }
            }
        }

        // 3. Fallback: Truncated Array Recovery
        // If it starts with [ but doesn't have a matching ], try to close it at the last }
        if (sanitized.startsWith("[")) {
            const lastBrace = sanitized.lastIndexOf("}");
            if (lastBrace > 0) {
                const potentialJson = sanitized.substring(0, lastBrace + 1) + "]";
                try {
                    return JSON.parse(potentialJson);
                } catch (e5) {
                    console.error("Truncated recovery failed:", e5);
                }
            }
        }

        console.error("extractJson: Failed all heuristic attempts for content:", content.substring(0, 100) + "...");
        return null;
    }
}
