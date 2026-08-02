import { ROOT_WIN, ROOT_DOC, CONTENT_DOC, CONTENT_WIN } from "../dom/context";
import { trimRangeWhitespace } from "../dom/ranges";

type ExplainLang = "de" | "en" | "es" | "fr" | "ru" | "la" | "cs" | "pl";

interface ExplainResult {
	lang: ExplainLang;
	meanings: string[];
	sourceUrl: string;
	sourceLabel: string;
}

interface ExplainContext {
	text: string;
	words: Set<string>;
}

type ExplainContextKind = "tech" | "general";

const LANG_DOMAINS: Record<ExplainLang, string[]> = {
	de: ["de.wiktionary.org", "en.wiktionary.org"],
	en: ["en.wiktionary.org"],
	es: ["es.wiktionary.org", "en.wiktionary.org"],
	fr: ["fr.wiktionary.org", "en.wiktionary.org"],
	ru: ["ru.wiktionary.org", "en.wiktionary.org"],
	la: ["la.wiktionary.org", "en.wiktionary.org"],
	cs: ["cs.wiktionary.org", "en.wiktionary.org"],
	pl: ["pl.wiktionary.org", "en.wiktionary.org"]
};

const GLOBAL_FALLBACK_DOMAINS = [
	"en.wiktionary.org",
	"de.wiktionary.org",
	"es.wiktionary.org",
	"fr.wiktionary.org",
	"ru.wiktionary.org",
	"la.wiktionary.org",
	"cs.wiktionary.org",
	"pl.wiktionary.org"
];

const LANG_ALIAS: Record<string, string> = {
	cz: "cs",
	pn: "pl"
};

const MESSAGES: Record<string, { loading: string; empty: string; noWord: string; notFound: string; error: string; source: string; otherMeaning: string }> = {
	en: {
		loading: "Looking up explanation...",
		empty: "Please select one word.",
		noWord: "Please select one word (letters only).",
		notFound: "No Wiktionary entry found for this word.",
		error: "Could not load explanation.",
		source: "Source",
		otherMeaning: "Other meaning"
	},
	de: {
		loading: "Erklärung wird geladen...",
		empty: "Bitte genau ein Wort markieren.",
		noWord: "Bitte genau ein Wort markieren (nur Buchstaben).",
		notFound: "Kein Wiktionary-Eintrag für dieses Wort gefunden.",
		error: "Erklärung konnte nicht geladen werden.",
		source: "Quelle",
		otherMeaning: "Weitere Bedeutung"
	},
	cs: {
		loading: "Načítám vysvětlení...",
		empty: "Vyberte přesně jedno slovo.",
		noWord: "Vyberte přesně jedno slovo (pouze písmena).",
		notFound: "Pro toto slovo nebyl nalezen záznam ve Wiktionary.",
		error: "Vysvětlení se nepodařilo načíst.",
		source: "Zdroj",
		otherMeaning: "Další význam"
	},
	es: {
		loading: "Buscando explicación...",
		empty: "Seleccione exactamente una palabra.",
		noWord: "Seleccione exactamente una palabra (solo letras).",
		notFound: "No se encontró una entrada de Wiktionary para esta palabra.",
		error: "No se pudo cargar la explicación.",
		source: "Fuente",
		otherMeaning: "Otro significado"
	},
	fr: {
		loading: "Recherche de l'explication...",
		empty: "Veuillez sélectionner exactement un mot.",
		noWord: "Veuillez sélectionner exactement un mot (lettres uniquement).",
		notFound: "Aucune entrée Wiktionary trouvée pour ce mot.",
		error: "Impossible de charger l'explication.",
		source: "Source",
		otherMeaning: "Autre sens"
	},
	it: {
		loading: "Ricerca della spiegazione...",
		empty: "Seleziona esattamente una parola.",
		noWord: "Seleziona esattamente una parola (solo lettere).",
		notFound: "Nessuna voce Wiktionary trovata per questa parola.",
		error: "Impossibile caricare la spiegazione.",
		source: "Fonte",
		otherMeaning: "Altro significato"
	},
	nl: {
		loading: "Uitleg wordt opgezocht...",
		empty: "Selecteer precies een woord.",
		noWord: "Selecteer precies een woord (alleen letters).",
		notFound: "Geen Wiktionary-item gevonden voor dit woord.",
		error: "Uitleg kon niet worden geladen.",
		source: "Bron",
		otherMeaning: "Andere betekenis"
	},
	pt: {
		loading: "A procurar explicação...",
		empty: "Selecione exatamente uma palavra.",
		noWord: "Selecione exatamente uma palavra (apenas letras).",
		notFound: "Nenhuma entrada do Wiktionary encontrada para esta palavra.",
		error: "Não foi possível carregar a explicação.",
		source: "Fonte",
		otherMeaning: "Outro significado"
	},
	la: {
		loading: "Explicatio quaeritur...",
		empty: "Unum verbum tantum selige.",
		noWord: "Unum verbum tantum selige (litterae tantum).",
		notFound: "Nullum lemma in Wiktionario repertum est.",
		error: "Explicatio onerari non potuit.",
		source: "Fons",
		otherMeaning: "Alius sensus"
	},
	pl: {
		loading: "Wyszukiwanie wyjaśnienia...",
		empty: "Zaznacz dokładnie jedno słowo.",
		noWord: "Zaznacz dokładnie jedno słowo (tylko litery).",
		notFound: "Nie znaleziono hasła Wiktionary dla tego słowa.",
		error: "Nie można załadować wyjaśnienia.",
		source: "Źródło",
		otherMeaning: "Inne znaczenie"
	},
	tr: {
		loading: "Açıklama aranıyor...",
		empty: "Lütfen tam olarak bir kelime seçin.",
		noWord: "Lütfen tam olarak bir kelime seçin (yalnızca harfler).",
		notFound: "Bu kelime için Wiktionary girdisi bulunamadı.",
		error: "Açıklama yüklenemedi.",
		source: "Kaynak",
		otherMeaning: "Diğer anlam"
	},
	ru: {
		loading: "Поиск объяснения...",
		empty: "Выделите ровно одно слово.",
		noWord: "Выделите ровно одно слово (только буквы).",
		notFound: "Для этого слова не найдено записи в Wiktionary.",
		error: "Не удалось загрузить объяснение.",
		source: "Источник",
		otherMeaning: "Другое значение"
	}
};

const CACHE = new Map<string, ExplainResult>();
let currentToken = 0;
let __globalWired = false;
let activeMeaningState: { word: string; meanings: string[]; index: number; sourceLabel: string; sourceUrl: string; rect: DOMRect } | null = null;

function hideTooltip(): void {
	const tip = CONTENT_DOC.getElementById("lia-hl-explain-tip") as HTMLElement | null;
	if (!tip) return;
	tip.classList.remove("is-open");
	tip.style.display = "none";
	tip.style.visibility = "hidden";
}

function eventContainsTooltip(event: Event): boolean {
	const tip = CONTENT_DOC.getElementById("lia-hl-explain-tip");
	if (!tip) return false;

	const pathFn = (event as Event & { composedPath?: () => EventTarget[] }).composedPath;
	if (typeof pathFn === "function") {
		const path = pathFn.call(event);
		if (Array.isArray(path) && path.includes(tip)) return true;
	}

	const raw = event.target as Node | null;
	if (!raw) return false;
	const el = raw.nodeType === 1 ? raw as Element : raw.parentElement;
	if (!el) return false;
	return !!el.closest("#lia-hl-explain-tip");
}

function uiLang(): string {
	const candidates = [
		ROOT_DOC.documentElement.getAttribute("lang"),
		ROOT_DOC.body.getAttribute("lang"),
		CONTENT_DOC.documentElement.getAttribute("lang"),
		CONTENT_DOC.body.getAttribute("lang"),
		ROOT_DOC.documentElement.getAttribute("data-language"),
		ROOT_DOC.body.getAttribute("data-language"),
		CONTENT_DOC.documentElement.getAttribute("data-language"),
		CONTENT_DOC.body.getAttribute("data-language")
	];

	const raw = (candidates.find((v) => !!(v && v.trim())) || "en").trim().toLowerCase();
	const baseRaw = raw.split("-")[0] || "en";
	return LANG_ALIAS[baseRaw] || baseRaw;
}

function t(): { loading: string; empty: string; noWord: string; notFound: string; error: string; source: string; otherMeaning: string } {
	const lang = uiLang();
	return MESSAGES[lang] || MESSAGES.en;
}

function cleanWord(raw: string): string {
	const trimmed = (raw || "").trim();
	if (!trimmed) return "";
	return trimmed.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ'’-]+|[^A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ'’-]+$/g, "");
}

function extractVisibleWords(raw: string): string[] {
	if (!raw) return [];
	const matches = raw.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+)*/g) || [];
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const m of matches) {
		const w = cleanWord(m).replace(/[’]/g, "'");
		if (!w) continue;
		const key = w.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(w);
	}
	return unique;
}

function extractWordAtTextOffset(text: string, offset: number): string {
	if (!text) return "";
	const idx = Math.max(0, Math.min(text.length - 1, offset));
	const wordRe = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+)*/g;
	let m: RegExpExecArray | null;
	while ((m = wordRe.exec(text)) !== null) {
		const start = m.index;
		const end = start + m[0].length;
		if (idx >= start && idx <= end) return cleanWord(m[0]).replace(/[’]/g, "'");
	}
	return "";
}

function extractBoundaryWord(range: Range): string {
	const fromPoint = (node: Node, offset: number): string => {
		if (node.nodeType === Node.TEXT_NODE) {
			return extractWordAtTextOffset(node.textContent || "", offset);
		}
		const el = node as Element;
		const child = el.childNodes[Math.max(0, Math.min(el.childNodes.length - 1, offset))] || null;
		if (child && child.nodeType === Node.TEXT_NODE) {
			return extractWordAtTextOffset(child.textContent || "", 0);
		}
		const txt = el.textContent || "";
		return extractWordAtTextOffset(txt, Math.max(0, Math.min(txt.length - 1, offset)));
	};

	const a = fromPoint(range.startContainer, range.startOffset);
	if (a) return a;
	const b = fromPoint(range.endContainer, Math.max(0, range.endOffset - 1));
	return b;
}

function pickDocLang(): ExplainLang {
	const raw = (
		CONTENT_DOC.documentElement.getAttribute("lang") ||
		CONTENT_DOC.body.getAttribute("lang") ||
		ROOT_DOC.documentElement.getAttribute("lang") ||
		ROOT_DOC.body.getAttribute("lang") ||
		"en"
	).toLowerCase();
	const baseRaw = raw.split("-")[0];
	const base = LANG_ALIAS[baseRaw] || baseRaw;
	if (["de", "en", "es", "fr", "ru", "la", "cs", "pl"].includes(base)) return base as ExplainLang;
	return "en";
}

function detectWordLanguage(word: string): ExplainLang {
	const w = word.toLowerCase();

	if (/[\u0400-\u04FF]/.test(w)) return "ru";
	if (/[äöüß]/.test(w)) return "de";
	if (/[ñ¿¡]/.test(w)) return "es";
	if (/[àâæçéèêëîïôœùûüÿ]/.test(w)) return "fr";
	if (/[ąćęłńóśźż]/.test(w)) return "pl";
	if (/[áčďéěíňóřšťúůýž]/.test(w)) return "cs";

	if (/(us|um|ae|am|em|is|ibus|orum|arum|que)$/i.test(w)) return "la";

	return pickDocLang();
}

function splitFirstUsefulLine(extract: string): string {
	if (!extract) return "";
	const lines = extract
		.split("\n")
		.map((x) => x.trim())
		.filter((x) => !!x)
		.filter((x) => !/^=+/.test(x));
	if (!lines.length) return "";

	const first = lines[0];
	const sentence = first.split(/(?<=[.!?])\s+/).find((s) => s.trim().length > 20) || first;
	return sentence.trim();
}

function stripWikiMarkup(input: string): string {
	if (!input) return "";
	let out = input;

	// Remove templates (repeat to resolve nested templates stepwise).
	for (let i = 0; i < 8; i++) {
		const next = out.replace(/\{\{[^{}]*\}\}/g, "");
		if (next === out) break;
		out = next;
	}
	// Convert wiki links [[target|label]] or [[target]].
	out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
	out = out.replace(/\[\[([^\]]+)\]\]/g, "$1");
	// Remove external link markup [url label].
	out = out.replace(/\[[^\s\]]+\s+([^\]]+)\]/g, "$1");
	out = out.replace(/'''+/g, "").replace(/''/g, "");
	out = out.replace(/<[^>]+>/g, "");
	// Remove remaining template/table leftovers.
	out = out.replace(/\{\{[^\n]*/g, "");
	out = out.replace(/^\{\|.*$/gm, "");
	out = out.replace(/^\|\}.*$/gm, "");
	out = out.replace(/^\|[^\n]*$/gm, "");
	out = out.replace(/\s+/g, " ").trim();

	return out;
}

function expandTemplateDefinition(raw: string): string {
	const altSp = raw.match(/\{\{\s*alt sp\|[^|]+\|([^}|]+)[^}]*\}\}/i);
	if (altSp && altSp[1]) {
		const term = stripWikiMarkup(altSp[1]);
		if (term) return `Alternative spelling of ${term}.`;
	}

	const gloss = raw.match(/\{\{\s*gloss\|([^}]+)\}\}/i);
	if (gloss && gloss[1]) {
		const term = stripWikiMarkup(gloss[1]);
		if (term) return term;
	}

	return "";
}

function buildContextTextFromRange(range: Range): ExplainContext {
	const host = range.commonAncestorContainer.nodeType === 1
		? range.commonAncestorContainer as Element
		: range.commonAncestorContainer.parentElement;

	const block = host?.closest?.("p, li, td, th, h1, h2, h3, h4, h5, h6, div, section, article") || host;
	const text = ((block as Element | null)?.textContent || "").toLowerCase();
	const words = new Set(
		text
			.replace(/[^a-zà-öø-ÿа-я0-9\s-]/gi, " ")
			.split(/\s+/)
			.filter((x) => x.length >= 3)
	);

	return { text, words };
}

function getContextKind(ctx?: ExplainContext): ExplainContextKind {
	if (!ctx) return "general";
	const c = ctx.text;
	const technicalContext =
		c.includes("plugin") || c.includes("quiz") || c.includes("macro") ||
		c.includes("highlight") || c.includes("textmarker") || c.includes("tool") ||
		c.includes("whiteboard");
	return technicalContext ? "tech" : "general";
}

function scoreDefinition(raw: string, cleaned: string, ctx?: ExplainContext): number {
	let score = 0;
	const lc = cleaned.toLowerCase();
	const rawLc = raw.toLowerCase();

	if (!cleaned || cleaned.length < 8) return -999;

	if (/(past tense|past participle|plural of|form of|inflection of)/i.test(cleaned)) score += 45;
	if (/(archaic|obsolete|rare)/i.test(cleaned)) score -= 15;
	if (/\bab\s+\d{3,4}\b/i.test(cleaned) && /\bbelegt\b/i.test(cleaned)) score -= 65;
	if (/\b(?:diese|jene)\s+bedeutung\s+belegt\b/i.test(cleaned)) score -= 65;
	if (/\bvergleiche\b/i.test(cleaned) && cleaned.length <= 140) score -= 45;
	if (/^\s*vgl\.?\s+/i.test(cleaned)) score -= 45;
	if (/(currency|coin|subdivision of currency|monetary)/i.test(cleaned)) score -= 20;
	if (/(^|\b)(an|a) inhabitant of\b/.test(lc)) score -= 28;
	if (/\bdemonym\b/.test(lc)) score -= 20;
	if (/\{\{\s*quote-|\{\{\s*col\|/i.test(rawLc)) score -= 40;

	if (cleaned.length >= 20 && cleaned.length <= 180) score += 8;
	if (cleaned.length > 260) score -= 8;

	if (/^[A-Z]/.test(cleaned)) score += 1;
	if (/\.$/.test(cleaned)) score += 1;

	if (lc.includes("wiktionary") || lc.includes("wikipedia")) score -= 25;
	if (/\bbelegt\b/.test(lc) && /\b\d{3,4}\b/.test(lc)) score -= 65;
	if (/\bvergleiche\b/.test(lc)) score -= 45;
	if (/^\s*vgl\.?\s+/.test(lc)) score -= 45;
	if (/\bbedeutung\b.*\bfu(?:s|ß)t\b/.test(lc)) score -= 80;
	if (/\bvorstellung\b/.test(lc) && /\b(?:prostituierte|katze)\b/.test(lc)) score -= 120;
	if (/\b(?:slang|urban|colloquial|vulgar|offensive|prostitute|prostitution|sex worker|whore|hooker|escort)\b/.test(lc)) score -= 220;
	if (/\b(?:umgangssprachlich|salopp|derb|vulgaer|vulgär|beleidigend|prostituierte|prostitution|hure|nutte|sexarbeiter(?:in)?)\b/.test(lc)) score -= 220;

	if (ctx) {
		const technicalContext = getContextKind(ctx) === "tech";

		if (technicalContext) {
			if (/(felt-?tipped|marker pen|highlighter|whiteboard|permanent marker|pen)/i.test(lc)) score += 35;
			if (/(assigns marks|grader|test|examination|someone who assigns marks)/i.test(lc)) score -= 35;
		}

		if (ctx.words.has("write") || ctx.words.has("written") || ctx.words.has("text")) {
			if (/(pen|marker pen|felt-?tipped|highlighter)/i.test(lc)) score += 10;
		}
	}

	return score;
}

function isNoisyDefinition(raw: string, cleaned: string): boolean {
	const r = raw.toLowerCase();
	const c = cleaned.toLowerCase();
	if (r.includes("{{quote-")) return true;
	if (r.includes("{{col|")) return true;
	if (/^#?\s*redirect\b/i.test(raw)) return true;
	if (/^#?\s*weiterleitung\b/i.test(raw)) return true;
	if (/^\s*redirect\b/i.test(cleaned)) return true;
	if (/^\s*weiterleitung\b/i.test(cleaned)) return true;
	if (/\bab\s+\d{3,4}\b/i.test(cleaned) && /\bbelegt\b/i.test(cleaned)) return true;
	if (/\b(?:diese|jene)\s+bedeutung\s+belegt\b/i.test(cleaned)) return true;
	if (/\bbedeutung\b.*\bfu(?:s|ß)t\b/i.test(cleaned)) return true;
	if (/\bvorstellung\b/i.test(cleaned) && /\b(?:prostituierte|katze)\b/i.test(cleaned)) return true;
	if (/\bvergleiche\b/i.test(cleaned) && cleaned.length <= 140) return true;
	if (/^\s*vgl\.?\s+/i.test(cleaned)) return true;
	if (/\b(?:slang|urban|colloquial|vulgar|offensive|prostitute|prostitution|sex worker|whore|hooker|escort)\b/i.test(c)) return true;
	if (/\b(?:umgangssprachlich|salopp|derb|vulgaer|vulgär|beleidigend|prostituierte|prostitution|hure|nutte|sexarbeiter(?:in)?)\b/i.test(c)) return true;
	if (r.includes("|isbn=") || r.includes("|publisher=") || r.includes("|author=") || r.includes("|url=")) return true;
	if (/^\*\s*\{\{/.test(raw.trim())) return true;
	if (/^\s*\|/.test(raw)) return true;
	if (/^\s*\{\|/.test(raw)) return true;
	if (/^\s*====?\s*.+\s*====?\s*$/.test(raw)) return true;
	if (cleaned.includes("{{") || cleaned.includes("}}")) return true;
	if (/\b(year|publisher|isbn|author|passage|title)\s*=\s*/i.test(cleaned)) return true;
	if (!cleaned || cleaned.length < 8) return true;
	return false;
}

function extractRedirectTarget(wikitext: string): string {
	if (!wikitext) return "";
	const first = wikitext.split("\n", 1)[0] || "";
	const m = first.match(/^#\s*(?:redirect|weiterleitung)\s*\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|[^\]]+)?\]\]/i);
	if (!m || !m[1]) return "";
	return m[1].trim();
}

function normalizeMeaningTokens(text: string): string[] {
	const stop = new Set([
		"a", "an", "the", "of", "to", "and", "or", "for", "with", "in", "on", "by", "from", "as", "at", "is", "are", "be", "being", "been",
		"ein", "eine", "einer", "eines", "der", "die", "das", "des", "dem", "den", "und", "oder", "mit", "von", "im", "in", "auf", "zu", "ist", "sind"
	]);

	const canonical = (token: string): string => {
		let t = token.toLowerCase();
		t = t.replace(/^[^a-zà-öø-ÿа-я]+|[^a-zà-öø-ÿа-я]+$/gi, "");
		if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
		if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
		if (t.length > 4 && t.endsWith("es")) t = t.slice(0, -2);
		if (t.length > 3 && t.endsWith("s")) t = t.slice(0, -1);
		return t;
	};

	return text
		.toLowerCase()
		.split(/\s+/)
		.map(canonical)
		.filter((x) => x.length >= 3 && !stop.has(x));
}

function meaningSimilarity(a: string, b: string): number {
	const aSet = new Set(normalizeMeaningTokens(a));
	const bSet = new Set(normalizeMeaningTokens(b));
	if (!aSet.size || !bSet.size) return 0;

	let inter = 0;
	for (const t of aSet) {
		if (bSet.has(t)) inter++;
	}
	const union = aSet.size + bSet.size - inter;
	if (!union) return 0;
	return inter / union;
}

function isNearDuplicateMeaning(candidate: string, selected: string[]): boolean {
	for (const other of selected) {
		if (meaningSimilarity(candidate, other) >= 0.5) return true;
	}
	return false;
}

function classifyMeaningFamily(text: string): string {
	const lc = text.toLowerCase();

	if (/(satisfied|pleased|contented|satisfaction|contentment|happy|glad|pleasure)/i.test(lc)) return "satisfaction";
	if (/(vote|bill|motion|assent|affirmative|member who votes|parliament)/i.test(lc)) return "voting";
	if (/(acquiescence|without examination|compliance|submission)/i.test(lc)) return "acquiescence";
	if (/(contained|content of|subject matter|material|information|text body|payload|substance)/i.test(lc)) return "information";
	if (/(form of|plural of|past tense|past participle|inflection of)/i.test(lc)) return "inflection";

	const tokens = normalizeMeaningTokens(text).slice(0, 2);
	if (!tokens.length) return "other";
	return `other:${tokens.join("-")}`;
}

function buildLookupCandidates(word: string, lang?: ExplainLang): string[] {
	const w = word.trim();
	if (!w) return [];

	const lower = w.toLowerCase();
	const out: string[] = [];
	const seen = new Set<string>();

	const push = (v: string) => {
		const x = v.trim();
		if (!x) return;
		const k = x.toLowerCase();
		if (seen.has(k)) return;
		seen.add(k);
		out.push(x);
	};

	const titleCase = /^[A-Z][a-z]+$/.test(w);

	if (titleCase) {
		if (lang === "de") {
			// In German, uppercase often marks nouns (e.g. Schritt), so prefer original case first.
			push(w);
			push(lower);
		} else {
			// For words like "Marker" prefer common-lemma lookup first.
			push(lower);
			push(w);
		}
	} else {
		push(w);
		push(lower);
	}

	push(lower.charAt(0).toUpperCase() + lower.slice(1));

	const irregularEn: Record<string, string> = {
		sent: "send",
		went: "go",
		done: "do",
		made: "make",
		seen: "see",
		known: "know",
		taken: "take",
		given: "give",
		written: "write",
		spoken: "speak",
		built: "build",
		bought: "buy",
		brought: "bring",
		thought: "think",
		found: "find",
		left: "leave",
		felt: "feel"
	};
	if (irregularEn[lower]) push(irregularEn[lower]);

	// English plural heuristics
	if (lower.endsWith("ies") && lower.length > 4) push(lower.slice(0, -3) + "y");
	if (lower.endsWith("es") && lower.length > 4) push(lower.slice(0, -2));
	if (lower.endsWith("s") && lower.length > 3) push(lower.slice(0, -1));

	// English verb/adjective inflection heuristics
	if (lower.endsWith("ied") && lower.length > 4) push(lower.slice(0, -3) + "y");
	if (lower.endsWith("ed") && lower.length > 4) {
		const stem = lower.slice(0, -2);
		push(stem);
		push(stem + "e");
		if (/([bcdfghjklmnpqrstvwxyz])\1$/i.test(stem)) push(stem.slice(0, -1));
	}
	if (lower.endsWith("ing") && lower.length > 5) {
		const stem = lower.slice(0, -3);
		push(stem);
		push(stem + "e");
		if (/([bcdfghjklmnpqrstvwxyz])\1$/i.test(stem)) push(stem.slice(0, -1));
	}

	// German plural heuristics
	for (const suf of ["nen", "ern", "en", "er", "e", "n", "s"]) {
		if (lower.endsWith(suf) && lower.length > suf.length + 2) {
			push(lower.slice(0, -suf.length));
		}
	}

	return out;
}

function parseDefinitionsFromWikitext(wikitext: string, ctx?: ExplainContext): string[] {
	if (!wikitext) return [];
	const lines = wikitext.split("\n");
	const candidates: Array<{ raw: string; cleaned: string; score: number }> = [];

	const pushCandidate = (raw: string, cleaned: string) => {
		if (isNoisyDefinition(raw, cleaned)) return;
		const score = scoreDefinition(raw, cleaned, ctx);
		if (score <= -900) return;
		candidates.push({ raw, cleaned, score });
	};

	// De-wiktionary often stores meanings as :[1] ... after {{Bedeutungen}}.
	const idxMeaning = lines.findIndex((line) => /\{\{\s*Bedeutungen\s*\}\}/i.test(line));
	if (idxMeaning >= 0) {
		for (let i = idxMeaning + 1; i < Math.min(lines.length, idxMeaning + 30); i++) {
			const m = lines[i].match(/^:\[(\d+)\]\s*(.+)$/);
			if (!m) continue;
			const expanded = expandTemplateDefinition(m[2]);
			if (expanded) pushCandidate(m[2], expanded);
			const cleaned = stripWikiMarkup(m[2]);
			if (cleaned.length >= 12) pushCandidate(m[2], cleaned);
		}
	}

	// Generic wiktionary fallback: numbered definition list in wikitext.
	for (const line of lines) {
		const m = line.match(/^#(?![:*])\s*(.+)$/);
		if (!m) continue;
		const expanded = expandTemplateDefinition(m[1]);
		if (expanded) pushCandidate(m[1], expanded);
		const cleaned = stripWikiMarkup(m[1]);
		if (cleaned.length >= 12) pushCandidate(m[1], cleaned);
	}

	if (candidates.length) {
		candidates.sort((a, b) => b.score - a.score);
		const preselected: Array<{ text: string; family: string }> = [];
		const seen = new Set<string>();
		for (const c of candidates) {
			const key = c.cleaned.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			if (isNearDuplicateMeaning(c.cleaned, preselected.map((x) => x.text))) continue;
			preselected.push({ text: c.cleaned, family: classifyMeaningFamily(c.cleaned) });
			if (preselected.length >= 14) break;
		}

		const byFamily = new Map<string, string[]>();
		for (const m of preselected) {
			const arr = byFamily.get(m.family) || [];
			arr.push(m.text);
			byFamily.set(m.family, arr);
		}

		const unique: string[] = [];
		const families = Array.from(byFamily.keys());
		while (unique.length < 6) {
			let progressed = false;
			for (const fam of families) {
				if (unique.length >= 6) break;
				const arr = byFamily.get(fam);
				if (!arr || !arr.length) continue;
				const next = arr.shift()!;
				if (isNearDuplicateMeaning(next, unique)) continue;
				unique.push(next);
				progressed = true;
			}
			if (!progressed) break;
		}
		return unique;
	}

	// Last resort: first useful non-heading line.
	for (const raw of lines) {
		if (/^#[:*]/.test(raw.trim())) continue;
		if (/\{\{\s*quote-/i.test(raw)) continue;
		if (/\{\{/.test(raw)) continue;
		if (/^\s*\|/.test(raw)) continue;
		if (/^\s*\{\|/.test(raw)) continue;
		const line = stripWikiMarkup(raw.replace(/^:+/, "").replace(/^\*+/, ""));
		if (!line) continue;
		if (/^==+/.test(raw.trim())) continue;
		if (/^\s*[A-Z][A-Za-z\s-]{2,30}:\s*$/.test(line)) continue;
		if (line.length >= 24) return [line];
	}

	return [];
}

async function fetchDefinitionsFromDomain(domain: string, word: string, ctx?: ExplainContext, depth = 0): Promise<string[]> {
	const url = `https://${domain}/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&formatversion=2&format=json&origin=*`;
	const res = await fetch(url, { method: "GET" });
	if (!res.ok) return [];

	const json = await res.json() as { parse?: { wikitext?: string } };
	const wt = json?.parse?.wikitext || "";
	if (!wt) return [];

	const redirectTarget = extractRedirectTarget(wt);
	if (redirectTarget && depth < 2) {
		return fetchDefinitionsFromDomain(domain, redirectTarget, ctx, depth + 1);
	}

	return parseDefinitionsFromWikitext(wt, ctx);
}

async function fetchFromDomain(domain: string, word: string, lang: ExplainLang, ctx?: ExplainContext): Promise<ExplainResult | null> {
	const candidates = buildLookupCandidates(word, lang);

	let lines: string[] = [];
	let hitWord = word;
	for (const candidate of candidates) {
		lines = await fetchDefinitionsFromDomain(domain, candidate, ctx);
		if (lines.length) {
			hitWord = candidate;
			break;
		}
	}
	if (!lines.length) return null;

	return {
		lang,
		meanings: lines,
		sourceLabel: "Wiktionary (CC BY-SA)",
		sourceUrl: `https://${domain}/wiki/${encodeURIComponent(hitWord)}`
	};
}

async function lookupWord(word: string, lang: ExplainLang, ctx?: ExplainContext): Promise<ExplainResult | null> {
	const key = `${lang}|${getContextKind(ctx)}|${word.toLowerCase()}`;
	if (CACHE.has(key)) return CACHE.get(key)!;

	const domains = Array.from(new Set([
		...(LANG_DOMAINS[lang] || LANG_DOMAINS.en),
		...GLOBAL_FALLBACK_DOMAINS
	]));
	for (const domain of domains) {
		try {
			const hit = await fetchFromDomain(domain, word, lang, ctx);
			if (hit) {
				CACHE.set(key, hit);
				return hit;
			}
		} catch (e) {
			// try next domain
		}
	}

	return null;
}

function ensureTooltip(): HTMLElement {
	let tip = CONTENT_DOC.getElementById("lia-hl-explain-tip") as HTMLElement | null;
	if (tip) return tip;

	tip = CONTENT_DOC.createElement("div");
	tip.id = "lia-hl-explain-tip";
	tip.className = "lia-hl-explain-tip";
	tip.innerHTML = [
		'<div class="lia-hl-explain-head">',
		'  <span id="lia-hl-explain-word"></span>',
		'  <button type="button" id="lia-hl-explain-close" aria-label="Close">✕</button>',
		'</div>',
		'<div class="lia-hl-explain-body" id="lia-hl-explain-body"></div>',
		'<div class="lia-hl-explain-actions">',
		'  <button type="button" id="lia-hl-explain-next"></button>',
		'  <span id="lia-hl-explain-count"></span>',
		'</div>',
		'<a class="lia-hl-explain-source" id="lia-hl-explain-source" href="#" target="_blank" rel="noopener noreferrer"></a>'
	].join("");

	CONTENT_DOC.body.appendChild(tip);

	const closeBtn = tip.querySelector("#lia-hl-explain-close") as HTMLButtonElement | null;
	closeBtn?.addEventListener("click", () => {
		hideTooltip();
	});

	const nextBtn = tip.querySelector("#lia-hl-explain-next") as HTMLButtonElement | null;
	nextBtn?.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (!activeMeaningState || activeMeaningState.meanings.length < 2) return;
		activeMeaningState.index = (activeMeaningState.index + 1) % activeMeaningState.meanings.length;
		const current = activeMeaningState.meanings[activeMeaningState.index] || "";
		const tMsg = t();
		const bodyEl = tip.querySelector("#lia-hl-explain-body") as HTMLElement | null;
		const srcEl = tip.querySelector("#lia-hl-explain-source") as HTMLAnchorElement | null;
		const countEl = tip.querySelector("#lia-hl-explain-count") as HTMLElement | null;
		if (bodyEl) bodyEl.textContent = current;
		if (srcEl) srcEl.textContent = `${tMsg.source}: ${activeMeaningState.sourceLabel}`;
		if (countEl) countEl.textContent = `${activeMeaningState.index + 1}/${activeMeaningState.meanings.length}`;
		placeTooltip(tip, activeMeaningState.rect);
	});

	if (!__globalWired) {
		__globalWired = true;

		const outsideClickHandler = (event: Event) => {
			if (eventContainsTooltip(event)) return;
			hideTooltip();
		};

		CONTENT_DOC.addEventListener("pointerdown", (e) => {
			outsideClickHandler(e);
		}, true);

		if (ROOT_DOC !== CONTENT_DOC) {
			ROOT_DOC.addEventListener("pointerdown", (e) => {
				outsideClickHandler(e);
			}, true);
		}

		CONTENT_DOC.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			hideTooltip();
		}, true);

		if (ROOT_DOC !== CONTENT_DOC) {
			ROOT_DOC.addEventListener("keydown", (e) => {
				if ((e as KeyboardEvent).key !== "Escape") return;
				hideTooltip();
			}, true);
		}

		CONTENT_WIN.addEventListener("blur", () => hideTooltip());
		ROOT_WIN.addEventListener("pointerdown", (e) => outsideClickHandler(e), true);
	}

	return tip;
}

function placeTooltip(tip: HTMLElement, rect: DOMRect): void {
	const pad = 8;
	const gap = 10;

	tip.style.display = "block";
	tip.style.visibility = "hidden";
	tip.style.left = "-9999px";
	tip.style.top = "-9999px";

	const w = tip.offsetWidth || 320;
	const h = tip.offsetHeight || 160;
	const vpW = CONTENT_WIN.innerWidth || CONTENT_DOC.documentElement.clientWidth || 0;
	const vpH = CONTENT_WIN.innerHeight || CONTENT_DOC.documentElement.clientHeight || 0;

	let left = rect.left + (rect.width / 2) - (w / 2);
	let top = rect.bottom + gap;
	if (top + h + pad > vpH) top = rect.top - h - gap;

	left = Math.max(pad, Math.min(vpW - w - pad, left));
	top = Math.max(pad, Math.min(vpH - h - pad, top));

	tip.style.left = `${Math.round(left)}px`;
	tip.style.top = `${Math.round(top)}px`;
	tip.style.display = "block";
	tip.style.visibility = "visible";
}

function updateTooltip(word: string, body: string, sourceLabel: string, sourceUrl: string, meaningIndex = 0, meaningCount = 1): HTMLElement {
	const tip = ensureTooltip();
	const wordEl = tip.querySelector("#lia-hl-explain-word") as HTMLElement | null;
	const bodyEl = tip.querySelector("#lia-hl-explain-body") as HTMLElement | null;
	const srcEl = tip.querySelector("#lia-hl-explain-source") as HTMLAnchorElement | null;
	const nextEl = tip.querySelector("#lia-hl-explain-next") as HTMLButtonElement | null;
	const countEl = tip.querySelector("#lia-hl-explain-count") as HTMLElement | null;

	if (wordEl) wordEl.textContent = word;
	if (bodyEl) bodyEl.textContent = body;
	if (srcEl) {
		srcEl.textContent = `${t().source}: ${sourceLabel}`;
		srcEl.href = sourceUrl;
	}
	if (nextEl) {
		nextEl.textContent = t().otherMeaning;
		nextEl.style.display = meaningCount > 1 ? "inline-flex" : "none";
	}
	if (countEl) {
		countEl.textContent = meaningCount > 1 ? `${meaningIndex + 1}/${meaningCount}` : "";
	}

	tip.style.display = "block";
	tip.classList.add("is-open");
	return tip;
}

export async function explainSelectionWord(retry = 0): Promise<void> {
	const sel = CONTENT_WIN.getSelection ? CONTENT_WIN.getSelection() : null;
	if (!sel || sel.rangeCount === 0) {
		if (retry < 2) {
			ROOT_WIN.setTimeout(() => { void explainSelectionWord(retry + 1); }, 40);
		}
		return;
	}

	const range = sel.getRangeAt(0).cloneRange();
	if (!range || range.collapsed) {
		if (retry < 2) {
			ROOT_WIN.setTimeout(() => { void explainSelectionWord(retry + 1); }, 40);
		}
		return;
	}

	if (!trimRangeWhitespace(range)) {
		if (retry < 2) {
			ROOT_WIN.setTimeout(() => { void explainSelectionWord(retry + 1); }, 40);
		}
		return;
	}

	const rawText = range.toString();
	const words = extractVisibleWords(rawText);
	const boundaryWord = extractBoundaryWord(range);
	const rect = range.getBoundingClientRect();
	const token = ++currentToken;

	const resolvedWord = words.length === 1 ? words[0] : boundaryWord;

	if (!resolvedWord) {
		const tip = updateTooltip("Explain Word", t().noWord, "Wiktionary (CC BY-SA)", "https://www.wiktionary.org/");
		placeTooltip(tip, rect);
		try { sel.removeAllRanges(); } catch (e) {}
		return;
	}

	const word = resolvedWord;
	const lang = detectWordLanguage(word);
	activeMeaningState = null;
	const tip = updateTooltip(word, t().loading, "Wiktionary (CC BY-SA)", "https://www.wiktionary.org/");
	placeTooltip(tip, rect);

	try { sel.removeAllRanges(); } catch (e) {}

	try {
		const result = await lookupWord(word, lang);
		if (token !== currentToken) return;

		if (!result) {
			const nf = updateTooltip(word, t().notFound, "Wiktionary (CC BY-SA)", "https://www.wiktionary.org/");
			placeTooltip(nf, rect);
			return;
		}

		const firstMeaning = result.meanings[0] || "";
		activeMeaningState = {
			word,
			meanings: result.meanings,
			index: 0,
			sourceLabel: result.sourceLabel,
			sourceUrl: result.sourceUrl,
			rect
		};
		const ok = updateTooltip(word, firstMeaning, result.sourceLabel, result.sourceUrl, 0, result.meanings.length);
		placeTooltip(ok, rect);
	} catch (e) {
		if (token !== currentToken) return;
		const err = updateTooltip(word, t().error, "Wiktionary (CC BY-SA)", "https://www.wiktionary.org/");
		placeTooltip(err, rect);
	}
}
