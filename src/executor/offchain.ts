import Dockerode from "dockerode";
import { StageInstruction } from "@drewpackages/engine";
import { normalize } from "path";
import { StateStorage } from "../state";
import { dockerUtils } from "../utils";

export class OffchainExecutor {
  private readonly docker: Dockerode;

  constructor(
    private readonly state: StateStorage,
    private readonly getFormulaPath: (name: string) => string,
    dockerOpts?: Dockerode.DockerOptions
  ) {
    this.docker = new Dockerode(dockerOpts);
  }

  async runStage(formulaPath: string, stage: StageInstruction) {
    const workdir = normalize(this.getFormulaPath(formulaPath));
    const Binds = [`${workdir}:/project:ro`];
    if ("dind" in stage && stage.dind) {
      Binds.push("/var/run/docker.sock:/var/run/docker.sock");
    }
    await dockerUtils.pullImage(this.docker, stage.image);
    await this.docker.run(
      stage.image,
      stage.cmd.map((cmd) => this.state.toValue(cmd)),
      process.stdout,
      {
        Env: Object.entries(stage.envs)
          .map(([name, val]) => [name, this.state.toValue(val)])
          .map(([name, val]) => `${name}=${val}`)
          .concat(`DREW_WORKDIR=${this.state.toValue(stage.workdir)}`),
        AttachStdout: true,
        AttachStderr: true,
        HostConfig: { AutoRemove: true, Binds },
      }
    );
  }
}
