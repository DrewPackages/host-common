import { IEnvironmentResolver } from "@drewpackages/engine";
import { IEnvironmentChanger } from "./types";

export class CombinedConfigResolver implements IEnvironmentResolver {
  private readonly envResolver: IEnvironmentResolver;
  private readonly fsResolver: IEnvironmentResolver & IEnvironmentChanger;

  constructor(
    env: IEnvironmentResolver,
    fs: IEnvironmentResolver & IEnvironmentChanger
  ) {
    this.envResolver = env;
    this.fsResolver = fs;
  }

  async getEnv(name: string): Promise<string> {
    let result: string;
    try {
      result = await this.envResolver.getEnv(name);
    } catch {
      result = await this.fsResolver.getEnv(name);
    }
    return result;
  }

  async getEnvBatch(...names: string[]): Promise<Record<string, string>> {
    return Object.fromEntries(
      await Promise.all(names.map(async (n) => [n, await this.getEnv(n)]))
    );
  }

  setEnv(name: string, value: string) {
    this.fsResolver.setEnv(name, value);
  }

  deleteEnv(name: string) {
    this.fsResolver.deleteEnv(name);
  }
}
