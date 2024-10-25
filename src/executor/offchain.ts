import Dockerode from "dockerode";
import { StageInstruction } from "@drewpackages/engine";
import { normalize } from "path";
import { StateStorage } from "../state";
import { dockerUtils } from "../utils";
import { BaseStageExecutor } from "./base";

export class OffchainExecutor extends BaseStageExecutor {
  private readonly docker: Dockerode;

  constructor(
    private readonly state: StateStorage,
    private readonly getFormulaPath: (name: string) => string,
    dockerOpts?: Dockerode.DockerOptions
  ) {
    super();
    this.docker = new Dockerode(dockerOpts);
  }

  async runStage(
    formulaPath: string,
    stage: StageInstruction
  ): Promise<Array<{ id: string; value: any }>> {
    const workdir = normalize(this.getFormulaPath(formulaPath));
    const Binds = [`${workdir}:/project:ro`];
    if ("dind" in stage && stage.dind) {
      Binds.push("/var/run/docker.sock:/var/run/docker.sock");
    }

    const isOutputsExpected = "outputs" in stage && stage.outputs.length > 0;

    const stdout = this.createStream("stdout");
    const stderr = this.createStream("stderr");

    await dockerUtils.pullImage(this.docker, stage.image);
    await this.docker.run(
      stage.image,
      stage.cmd.map((cmd) => this.state.toValue(cmd)),
      [stdout.stream, stderr.stream],
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

    const stdoutText = stdout.inMemory.toString();
    const stderrText = stderr.inMemory.toString();

    return isOutputsExpected
      ? stage.outputs
          .filter((o) => o.extract != null)
          .map((o) => ({
            id: o.id,
            value: this.readOutput(stdoutText, stderrText, o),
          }))
      : [];
  }
}
