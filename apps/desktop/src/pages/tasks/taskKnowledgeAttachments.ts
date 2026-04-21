import { readKnowledgeEntries } from "../../features/studio/knowledgeIndex";
import type { KnowledgeFileRef } from "../../features/workflow/types";
import { getBrowserAttachment } from "./browserAttachmentStore";

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type KnowledgeRetrieveResult = {
  snippets: Array<{
    fileId: string;
    fileName: string;
    chunkIndex: number;
    text: string;
    score: number;
  }>;
  warnings: string[];
};

export function findKnowledgeEntryIdByArtifact(artifactPath: string): string | null {
  const normalizedPath = String(artifactPath ?? "").trim();
  if (!normalizedPath) {
    return null;
  }
  const matched = readKnowledgeEntries().find((entry) =>
    String(entry.markdownPath ?? "").trim() === normalizedPath ||
    String(entry.jsonPath ?? "").trim() === normalizedPath ||
    String(entry.sourceFile ?? "").trim() === normalizedPath,
  );
  return matched?.id ?? null;
}

export async function buildPromptWithKnowledgeAttachments(params: {
  attachedFiles: KnowledgeFileRef[];
  prompt: string;
  cwd: string;
  hasTauriRuntime: boolean;
  invokeFn: InvokeFn;
}): Promise<string> {
  const normalizedPrompt = String(params.prompt ?? "").trim();
  if (!normalizedPrompt || params.attachedFiles.length === 0 || !params.hasTauriRuntime || !params.cwd) {
    const browserOnlySnippets = params.attachedFiles
      .map((file) => {
        const browserAttachment = getBrowserAttachment(file.id);
        if (!browserAttachment) {
          return null;
        }
        const text = browserAttachment.text.trim();
        if (!text) {
          return null;
        }
        return `## ${browserAttachment.name}\n${text.slice(0, 1800)}`;
      })
      .filter(Boolean)
      .join("\n\n");

    if (!browserOnlySnippets) {
      return normalizedPrompt;
    }

    const fileList = params.attachedFiles.map((file) => `- ${file.path}`).join("\n");
    return [
      normalizedPrompt,
      "",
      "Attached project files:",
      fileList,
      `\nRelevant snippets:\n\n${browserOnlySnippets}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const browserFiles = params.attachedFiles.filter((file) => Boolean(getBrowserAttachment(file.id)));
  const runtimeFiles = params.attachedFiles.filter((file) => !getBrowserAttachment(file.id));
  const browserSnippets: KnowledgeRetrieveResult["snippets"] = [];
  browserFiles.forEach((file) => {
    const browserAttachment = getBrowserAttachment(file.id);
    if (!browserAttachment) {
      return;
    }
    const text = browserAttachment.text.trim();
    if (!text) {
      return;
    }
    browserSnippets.push({
      fileId: file.id,
      fileName: browserAttachment.name,
      chunkIndex: 0,
      text: text.slice(0, 1800),
      score: 1,
    });
  });

  const retrieved = runtimeFiles.length > 0
    ? await params.invokeFn<KnowledgeRetrieveResult>("knowledge_retrieve", {
        files: runtimeFiles,
        query: normalizedPrompt,
        topK: 4,
        maxChars: 3600,
      })
    : { snippets: [], warnings: [] };
  const fileList = params.attachedFiles.map((file) => `- ${file.path}`).join("\n");
  const snippetBlock = [...browserSnippets, ...retrieved.snippets]
    .map((snippet, index) => `## ${index + 1}. ${snippet.fileName}\n${snippet.text}`)
    .join("\n\n");
  const warningBlock = retrieved.warnings.length > 0
    ? `\n\nWarnings:\n${retrieved.warnings.map((warning) => `- ${warning}`).join("\n")}`
    : "";
  return [
    normalizedPrompt,
    "",
    "Attached project files:",
    fileList,
    snippetBlock ? `\nRelevant snippets:\n\n${snippetBlock}` : "",
    warningBlock,
  ]
    .filter(Boolean)
    .join("\n");
}
