// src/core/concern-matcher.ts
// Pure functions for concern-based querying (US-CBQ-01).
// No fs imports -- functional core only.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConcernScanInput {
  concern: string;
  repoName: string;
  docPath: string;
  featureFiles: Array<{
    sourceFile: string;
    phase: string;
    content: string;
  }>;
  adrFiles: Array<{
    sourceFile: string;
    content: string;
  }>;
  claudeMdFile: { sourceFile: string; content: string } | null;
  featureDirectoryNames: string[];
}

export interface ConcernMatch {
  repoName: string;
  sourceFile: string;
  phase: string;
  snippet: string;
  relevance: "feature-level" | "architecture-level" | "repo-conventions";
}

export interface RejectedPath {
  repoName: string;
  sourceFile: string;
  snippet: string;
  type: "rejected_alternative";
}

export interface ConcernScanResult {
  matches: ConcernMatch[];
  rejectedPaths: RejectedPath[];
  truncationWarnings: string[];
}

export interface ConcernCandidateInput {
  featureDirectoryNames: string[];
  adrFiles: Array<{ sourceFile: string; content: string }>;
  featureFiles: Array<{ sourceFile: string; phase: string; content: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SNIPPET_MAX_CHARS = 8000;
const REJECTED_SNIPPET_MAX_CHARS = 1500;

const REJECTION_KEYWORDS = [
  "rejected:",
  "rejected —",
  "not built",
  "won't have",
  "wont have",
  "out of scope",
  "not in scope",
  "alternative considered and dismissed",
  "deferred",
  "discarded",
  "not chosen",
  "explicitly excluded",
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function containsConcern(text: string, concern: string): boolean {
  return text.toLowerCase().includes(concern.toLowerCase());
}

function containsRejectionKeyword(paragraph: string): boolean {
  const lower = paragraph.toLowerCase();
  return REJECTION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function capSnippetAtHeadingBoundary(content: string, maxChars: number): { snippet: string; truncated: boolean } {
  if (content.length <= maxChars) {
    return { snippet: content, truncated: false };
  }

  // Try to truncate at a heading boundary before maxChars
  const truncated = content.slice(0, maxChars);
  const lastHeading = truncated.lastIndexOf("\n#");
  if (lastHeading > 0) {
    return { snippet: content.slice(0, lastHeading), truncated: true };
  }

  return { snippet: truncated, truncated: true };
}

function splitIntoParagraphs(content: string): string[] {
  return content.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

const HEADING_PATTERN = /^(#{1,6})\s/;

interface HeadingLine {
  lineIndex: number;
  level: number;
}

function detectHeadingLines(lines: string[]): HeadingLine[] {
  const headings: HeadingLine[] = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(HEADING_PATTERN);
    const hashes = match?.[1];
    if (hashes) {
      headings.push({ lineIndex, level: hashes.length });
    }
  });
  return headings;
}

function findSectionEnd(headings: HeadingLine[], sectionStartIndex: number, totalLines: number): number {
  const currentHeading = headings[sectionStartIndex];
  if (!currentHeading) {
    return totalLines;
  }
  for (let i = sectionStartIndex + 1; i < headings.length; i++) {
    const candidate = headings[i];
    if (candidate && candidate.level <= currentHeading.level) {
      return candidate.lineIndex;
    }
  }
  return totalLines;
}

interface Section {
  text: string;
  ownText: string;
  startLineIndex: number;
  endLineIndex: number;
}

function findFirstChildHeadingLineIndex(
  headings: HeadingLine[],
  sectionStartIndex: number,
): number | null {
  const currentHeading = headings[sectionStartIndex];
  const nextHeading = headings[sectionStartIndex + 1];
  if (!currentHeading || !nextHeading) {
    return null;
  }
  return nextHeading.level > currentHeading.level ? nextHeading.lineIndex : null;
}

function partitionIntoSections(content: string): Section[] {
  const lines = content.split("\n");
  const headings = detectHeadingLines(lines);

  return headings.map((heading, index) => {
    const endLineIndex = findSectionEnd(headings, index, lines.length);
    const firstChildLineIndex = findFirstChildHeadingLineIndex(headings, index);
    const ownTextEndLineIndex = firstChildLineIndex ?? endLineIndex;
    return {
      text: lines.slice(heading.lineIndex, endLineIndex).join("\n"),
      ownText: lines.slice(heading.lineIndex, ownTextEndLineIndex).join("\n"),
      startLineIndex: heading.lineIndex,
      endLineIndex,
    };
  });
}

function isStructuralAncestor(candidate: Section, other: Section): boolean {
  return (
    candidate.startLineIndex <= other.startLineIndex &&
    candidate.endLineIndex >= other.endLineIndex &&
    !(candidate.startLineIndex === other.startLineIndex && candidate.endLineIndex === other.endLineIndex)
  );
}

interface SectionOccurrence {
  occurrenceCount: number;
  sectionIndex: number;
}

function excludeStructuralAncestors(
  candidates: SectionOccurrence[],
  sections: Section[],
  concern: string,
): SectionOccurrence[] {
  return candidates.filter((candidate) => {
    const candidateSection = sections[candidate.sectionIndex];
    if (!candidateSection) {
      return false;
    }
    const isPureAncestor = candidates.some((other) => {
      if (other.sectionIndex === candidate.sectionIndex) {
        return false;
      }
      const otherSection = sections[other.sectionIndex];
      if (!otherSection) {
        return false;
      }
      return isStructuralAncestor(candidateSection, otherSection);
    });
    if (!isPureAncestor) {
      return true;
    }
    // An ancestor only loses to its descendants when ALL of its matches come
    // from nested content -- if the concern also appears in the ancestor's
    // own text (outside any child heading), it remains a legitimate candidate.
    return countOccurrences(candidateSection.ownText, concern) > 0;
  });
}

function countOccurrences(text: string, concern: string): number {
  const lowerText = text.toLowerCase();
  const lowerConcern = concern.toLowerCase();
  if (lowerConcern.length === 0) {
    return 0;
  }

  let count = 0;
  let searchFrom = 0;
  let foundIndex = lowerText.indexOf(lowerConcern, searchFrom);
  while (foundIndex !== -1) {
    count += 1;
    searchFrom = foundIndex + lowerConcern.length;
    foundIndex = lowerText.indexOf(lowerConcern, searchFrom);
  }
  return count;
}

export function extractHeadingAnchoredSnippet(content: string, concern: string): string | null {
  const sections = partitionIntoSections(content);
  if (sections.length === 0) {
    return null;
  }

  const sectionOccurrenceCounts = sections.map((section) => countOccurrences(section.text, concern));
  const matchingSectionIndexes = sectionOccurrenceCounts
    .map((occurrenceCount, sectionIndex) => ({ occurrenceCount, sectionIndex }))
    .filter(({ occurrenceCount }) => occurrenceCount > 0);

  if (matchingSectionIndexes.length === 0) {
    return null;
  }

  const candidatesExcludingAncestors = excludeStructuralAncestors(matchingSectionIndexes, sections, concern);

  if (candidatesExcludingAncestors.length === 1) {
    const onlyCandidate = candidatesExcludingAncestors[0];
    return onlyCandidate ? sections[onlyCandidate.sectionIndex]?.text ?? null : null;
  }

  const mostDenseSection = candidatesExcludingAncestors.reduce((densest, candidate) =>
    candidate.occurrenceCount > densest.occurrenceCount ? candidate : densest,
  );

  return sections[mostDenseSection.sectionIndex]?.text ?? null;
}

// ---------------------------------------------------------------------------
// Public pure functions
// ---------------------------------------------------------------------------

export function validateConcern(
  concern: string,
): { valid: true } | { valid: false; reason: string } {
  const trimmed = concern.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Concern must not be empty." };
  }
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return { valid: false, reason: "Concern must contain at least one alphanumeric character." };
  }
  return { valid: true };
}

export function detectRejectedPaths(
  sourceFile: string,
  repoName: string,
  phase: string,
  content: string,
  concern: string,
): RejectedPath[] {
  const paragraphs = splitIntoParagraphs(content);

  return paragraphs
    .filter((paragraph) => containsConcern(paragraph, concern) && containsRejectionKeyword(paragraph))
    .map((paragraph) => {
      const { snippet } = capSnippetAtHeadingBoundary(paragraph, REJECTED_SNIPPET_MAX_CHARS);
      return {
        repoName,
        sourceFile,
        snippet,
        type: "rejected_alternative" as const,
      };
    });
}

const ADR_NUMERIC_PREFIX_PATTERN = /^ADR[-\s]?\d+:\s*/i;
const ADR_FILENAME_PATTERN = /^adr-\d+-(.+)\.md$/i;

/**
 * Extracts the TEXT of the first detected heading line in `content` (markup
 * stripped), with any leading `ADR-NNN:`/`ADR NNN:` numbering convention
 * also stripped. Returns null if `content` has no heading lines at all.
 */
export function extractFirstHeadingText(content: string): string | null {
  const lines = content.split("\n");
  const headings = detectHeadingLines(lines);
  const firstHeading = headings[0];
  if (!firstHeading) {
    return null;
  }

  const headingLine = lines[firstHeading.lineIndex] ?? "";
  const withoutMarkup = headingLine.replace(HEADING_PATTERN, "");
  return withoutMarkup.replace(ADR_NUMERIC_PREFIX_PATTERN, "").trim();
}

/** Derives a fallback candidate string from an ADR filename lacking a heading. */
function deriveAdrFilenameCandidate(sourceFile: string): string {
  const fileName = sourceFile.split("/").pop() ?? sourceFile;
  const match = fileName.match(ADR_FILENAME_PATTERN);
  return match?.[1] ?? fileName.replace(/\.md$/i, "");
}

function collectAdrCandidates(
  adrFiles: ConcernCandidateInput["adrFiles"],
): string[] {
  return adrFiles.map((adr) => extractFirstHeadingText(adr.content) ?? deriveAdrFilenameCandidate(adr.sourceFile));
}

function collectFeatureFileHeadingCandidates(
  featureFiles: ConcernCandidateInput["featureFiles"],
): string[] {
  const candidates: string[] = [];
  for (const file of featureFiles) {
    const lines = file.content.split("\n");
    const headings = detectHeadingLines(lines);
    for (const heading of headings) {
      const headingLine = lines[heading.lineIndex] ?? "";
      candidates.push(headingLine.replace(HEADING_PATTERN, "").trim());
    }
  }
  return candidates;
}

/**
 * Per-repo candidate concern/topic extraction (US-LC-01). Returns the flat
 * concatenation of feature directory names, ADR titles, and feature-file
 * heading text, in that order. No deduplication and no cap here -- both
 * happen once, across all repos combined, at the call site.
 */
export function collectConcernCandidates(input: ConcernCandidateInput): string[] {
  const { featureDirectoryNames, adrFiles, featureFiles } = input;
  return [
    ...featureDirectoryNames,
    ...collectAdrCandidates(adrFiles),
    ...collectFeatureFileHeadingCandidates(featureFiles),
  ];
}

export function matchConcernInSnapshot(input: ConcernScanInput): ConcernScanResult {
  const { concern, repoName, featureFiles, adrFiles, claudeMdFile, featureDirectoryNames } = input;
  const matches: ConcernMatch[] = [];
  const rejectedPaths: RejectedPath[] = [];
  const truncationWarnings: string[] = [];

  // Feature-level: content match OR directory name match
  for (const file of featureFiles) {
    const directoryMatch = featureDirectoryNames.some((name) =>
      containsConcern(name, concern),
    );
    const contentMatch = containsConcern(file.content, concern);

    if (contentMatch || directoryMatch) {
      const headingAnchored = extractHeadingAnchoredSnippet(file.content, concern);
      const sourceText = headingAnchored ?? file.content;
      const { snippet, truncated } = capSnippetAtHeadingBoundary(sourceText, SNIPPET_MAX_CHARS);
      if (truncated) {
        truncationWarnings.push(`${file.sourceFile} was truncated to ${SNIPPET_MAX_CHARS} chars`);
      }
      matches.push({
        repoName,
        sourceFile: file.sourceFile,
        phase: file.phase,
        snippet,
        relevance: "feature-level",
      });

      const rejected = detectRejectedPaths(file.sourceFile, repoName, file.phase, file.content, concern);
      rejectedPaths.push(...rejected);
    }
  }

  // Architecture-level: ADR content match
  for (const adr of adrFiles) {
    if (containsConcern(adr.content, concern)) {
      const headingAnchored = extractHeadingAnchoredSnippet(adr.content, concern);
      const sourceText = headingAnchored ?? adr.content;
      const { snippet, truncated } = capSnippetAtHeadingBoundary(sourceText, SNIPPET_MAX_CHARS);
      if (truncated) {
        truncationWarnings.push(`${adr.sourceFile} was truncated to ${SNIPPET_MAX_CHARS} chars`);
      }
      matches.push({
        repoName,
        sourceFile: adr.sourceFile,
        phase: "architecture",
        snippet,
        relevance: "architecture-level",
      });

      const rejected = detectRejectedPaths(adr.sourceFile, repoName, "architecture", adr.content, concern);
      rejectedPaths.push(...rejected);
    }
  }

  // Repo-conventions: CLAUDE.md match
  if (claudeMdFile !== null && containsConcern(claudeMdFile.content, concern)) {
    const headingAnchored = extractHeadingAnchoredSnippet(claudeMdFile.content, concern);
    const sourceText = headingAnchored ?? claudeMdFile.content;
    const { snippet, truncated } = capSnippetAtHeadingBoundary(sourceText, SNIPPET_MAX_CHARS);
    if (truncated) {
      truncationWarnings.push(`${claudeMdFile.sourceFile} was truncated to ${SNIPPET_MAX_CHARS} chars`);
    }
    matches.push({
      repoName,
      sourceFile: claudeMdFile.sourceFile,
      phase: "repo-conventions",
      snippet,
      relevance: "repo-conventions",
    });

    const rejected = detectRejectedPaths(claudeMdFile.sourceFile, repoName, "repo-conventions", claudeMdFile.content, concern);
    rejectedPaths.push(...rejected);
  }

  return { matches, rejectedPaths, truncationWarnings };
}
