import { IEnvironmentResolver } from "@drewpackages/engine";
import {
  createFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  writeFileSync,
} from "fs-extra";
import { IEnvironmentChanger } from "./types";

export class StoredConfigResolver
  implements IEnvironmentResolver, IEnvironmentChanger
{
  constructor(private readonly configFilePath: string) {
    if (!existsSync(configFilePath)) {
      createFileSync(this.configFilePath);
    }
    if (
      !configFilePath.endsWith(".json") ||
      !lstatSync(configFilePath).isFile()
    ) {
      throw new Error(`Invalid config file path: ${configFilePath}`);
    }
  }

  private readConfig(): Record<string, string> {
    const jsonText = readFileSync(this.configFilePath).toString("utf-8");

    return JSON.parse(jsonText || "{}");
  }

  private writeConfig(newConfig: object) {
    writeFileSync(this.configFilePath, JSON.stringify(newConfig));
  }

  setEnv(name: string, value: string) {
    const config = this.readConfig();

    config[name] = value;

    this.writeConfig(config);
  }

  deleteEnv(name: string) {
    const config = this.readConfig();

    delete config[name];

    this.writeConfig(config);
  }

  readEnv(name: string): string {
    const config = this.readConfig();
    if (name in config) {
      return config[name]!;
    }
    throw new Error(`Config not found error`);
  }

  async getEnv(name: string): Promise<string> {
    return this.readEnv(name);
  }

  async getEnvBatch(...names: string[]): Promise<Record<string, string>> {
    return Object.fromEntries(names.map((n) => [n, this.readEnv(n)]));
  }
}
