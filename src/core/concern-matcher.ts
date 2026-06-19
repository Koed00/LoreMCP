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

function capSnippetAtHeadingBoundary(content: string, maxChars: number): { snippet: string; truncated: boolean } {
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

function partitionIntoSections(content: string): string[] {
  const lines = content.split("\n");
  const headings = detectHeadingLines(lines);

  return headings.map((heading, index) => {
    const endLineIndex = findSectionEnd(headings, index, lines.length);
    return lines.slice(heading.lineIndex, endLineIndex).join("\n");
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

  const sectionOccurrenceCounts = sections.map((section) => countOccurrences(section, concern));
  const matchingSectionIndexes = sectionOccurrenceCounts
    .map((occurrenceCount, sectionIndex) => ({ occurrenceCount, sectionIndex }))
    .filter(({ occurrenceCount }) => occurrenceCount > 0);

  if (matchingSectionIndexes.length === 0) {
    return null;
  }

  const mostDenseSection = matchingSectionIndexes.reduce((densest, candidate) =>
    candidate.occurrenceCount > densest.occurrenceCount ? candidate : densest,
  );

  return sections[mostDenseSection.sectionIndex] ?? null;
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
