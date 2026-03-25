import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentProvider } from "./AgentProvider.js";

const GITIGNORE = `.env
patches/
logs/
worktrees/
`;

function buildEnvExample(envManifest: Record<string, string>): string {
  return (
    Object.entries(envManifest)
      .map(([key, comment]) => `# ${comment}\n${key}=`)
      .join("\n") + "\n"
  );
}

function getTemplatesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return join(dirname(thisFile), "templates");
}

const getTemplateDir = (
  templateName: string,
): Effect.Effect<string, Error, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const templateDir = join(getTemplatesDir(), templateName);
    yield* fs
      .readFileString(join(templateDir, "template.json"))
      .pipe(
        Effect.mapError(
          () =>
            new Error(
              `Unknown template: "${templateName}". Check available templates in src/templates/.`,
            ),
        ),
      );
    return templateDir;
  });

const copyTemplateFiles = (
  templateDir: string,
  destDir: string,
): Effect.Effect<void, Error, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const files = yield* fs
      .readDirectory(templateDir)
      .pipe(Effect.mapError((e) => new Error(e.message)));
    yield* Effect.all(
      files
        .filter((f) => f !== "template.json")
        .map((f) =>
          fs
            .copyFile(join(templateDir, f), join(destDir, f))
            .pipe(Effect.mapError((e) => new Error(e.message))),
        ),
      { concurrency: "unbounded" },
    );
  });

export const scaffold = (
  repoDir: string,
  provider: AgentProvider,
  templateName = "blank",
): Effect.Effect<void, Error, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const configDir = join(repoDir, ".sandcastle");

    const exists = yield* fs
      .exists(configDir)
      .pipe(Effect.mapError((e) => new Error(e.message)));
    if (exists) {
      yield* Effect.fail(
        new Error(
          ".sandcastle/ directory already exists. Remove it first if you want to re-initialize.",
        ),
      );
    }

    yield* fs
      .makeDirectory(configDir, { recursive: false })
      .pipe(Effect.mapError((e) => new Error(e.message)));

    const templateDir = yield* getTemplateDir(templateName);

    yield* Effect.all(
      [
        fs
          .writeFileString(
            join(configDir, "Dockerfile"),
            provider.dockerfileTemplate,
          )
          .pipe(Effect.mapError((e) => new Error(e.message))),
        fs
          .writeFileString(
            join(configDir, ".env.example"),
            buildEnvExample(provider.envManifest),
          )
          .pipe(Effect.mapError((e) => new Error(e.message))),
        fs
          .writeFileString(join(configDir, ".gitignore"), GITIGNORE)
          .pipe(Effect.mapError((e) => new Error(e.message))),
        fs
          .writeFileString(
            join(configDir, "config.json"),
            JSON.stringify({ agent: provider.name }, null, 2) + "\n",
          )
          .pipe(Effect.mapError((e) => new Error(e.message))),
        copyTemplateFiles(templateDir, configDir),
      ],
      { concurrency: "unbounded" },
    );
  });
