export interface IEnvironmentChanger {
  setEnv(name: string, value: string): void;
  deleteEnv(name: string): void;
}
