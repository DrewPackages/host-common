import { IFormulaFetcher } from "@drewpackages/engine";
import simpleGit from "simple-git";
import { normalize, join } from "path";
import fsExtra from "fs-extra";

const { readFile, mkdir, opendir } = fsExtra;

type ParsedFormulaRef = {
  repo: string;
  subtree?: string;
  rev?: string;
};

async function isEmptyDir(path: string) {
  try {
    const directory = await opendir(path);
    const entry = await directory.read();
    await directory.close();

    return entry === null;
  } catch (error) {
    return false;
  }
}

export class GitHubFetcher implements IFormulaFetcher {
  constructor(
    private readonly formulasDir: string,
    private readonly cloneWithProtocol: "https" | "ssh" = "https"
  ) {}

  private parseRef(formulaRef: string): ParsedFormulaRef {
    const rev = formulaRef.includes("@") ? formulaRef.split("@")[1] : undefined;
    const segments = formulaRef.replace(/\@.*/, "").split("/");

    return {
      repo: `${segments[0]}/${segments[1]}`,
      subtree: segments.length > 2 ? segments.slice(2).join("/") : undefined,
      rev,
    };
  }

  private formHttpsCloneLink(formulaRef: ParsedFormulaRef): string {
    return `https://github.com/${formulaRef.repo}.git`;
  }

  private formSshCloneLink(formulaRef: ParsedFormulaRef): string {
    return `git@github.com:${formulaRef.repo}.git`;
  }

  private getCloneLink(formulaRef: ParsedFormulaRef): string {
    if (this.cloneWithProtocol === "https") {
      return this.formHttpsCloneLink(formulaRef);
    }

    return this.formSshCloneLink(formulaRef);
  }

  private async clone(formulaRef: ParsedFormulaRef) {
    const repoPath = normalize(join(this.formulasDir, formulaRef.repo));
    await mkdir(repoPath, { recursive: true });
    const git = simpleGit(repoPath);
    await git.cwd({ path: repoPath });

    if (await isEmptyDir(repoPath)) {
      await git.clone(this.getCloneLink(formulaRef), repoPath, [
        "--recurse-submodules",
      ]);
    } else {
      const branches = await git.branch();
      if (branches.detached || !branches.current) {
        await git.checkout(branches.all[0], ["--recurse-submodules"]);
      }
      await git.pull(undefined, undefined, ["--recurse-submodules"]);
    }
    if (formulaRef.rev) {
      await git.checkout(formulaRef.rev, ["--recurse-submodules"]);
    }
  }

  private async getFormulaCommitHash(
    formulaRef: ParsedFormulaRef
  ): Promise<string | undefined> {
    const repoPath = normalize(join(this.formulasDir, formulaRef.repo));
    const git = simpleGit(repoPath);
    const log = await git.log();

    return log.latest?.hash;
  }

  private async readClonnedFile(
    formulaRef: ParsedFormulaRef,
    filePath: string
  ): Promise<string> {
    const repoPath = normalize(join(this.formulasDir, formulaRef.repo));
    const formulaDirname = formulaRef.subtree
      ? normalize(join(repoPath, formulaRef.subtree))
      : repoPath;

    const buffer = await readFile(join(formulaDirname, filePath));
    return buffer.toString("utf-8");
  }

  async fetchFormulaFileText(
    formulaRef: string,
    filePath: string
  ): Promise<string> {
    const parsedFormulaRef = this.parseRef(formulaRef);
    await this.clone(parsedFormulaRef);
    return this.readClonnedFile(parsedFormulaRef, filePath);
  }

  async getUnambiguousFormulaName(formulaName: string): Promise<string> {
    const parsedFormulaRef = this.parseRef(formulaName);
    const commitHash = await this.getFormulaCommitHash(parsedFormulaRef);

    return `${parsedFormulaRef.repo}${
      parsedFormulaRef.subtree ? `/${parsedFormulaRef.subtree}` : ""
    }${
      commitHash || parsedFormulaRef.rev
        ? `@${commitHash || parsedFormulaRef.rev}`
        : ""
    }`;
  }
}
