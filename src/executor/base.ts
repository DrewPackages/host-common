import { RegexOutputSpec, ScheduleOutput } from "@drewpackages/engine";
import { PassThrough } from "stream";
import { WritableStream } from "memory-streams";
import isBuffer from "is-buffer";

export abstract class BaseStageExecutor {
  protected createStream(to: "stderr" | "stdout"): {
    stream: NodeJS.WritableStream;
    inMemory: WritableStream;
  } {
    const stream = new PassThrough();
    const inMemory = new WritableStream();

    stream.on("data", (chunk) => {
      switch (to) {
        case "stderr":
          process.stderr.write(chunk);
        case "stdout":
          process.stdout.write(chunk);
      }
      if (isBuffer(chunk)) {
        (chunk as any)._isBuffer = true;
      }
      inMemory.write(chunk);
    });

    return { stream, inMemory: inMemory };
  }

  protected readOutput(
    stdout: string,
    stderr: string,
    outputSpec: Pick<ScheduleOutput, "id" | "extract">
  ): any {
    if (!outputSpec.extract) {
      throw new Error(
        `Output specification for output '${outputSpec.id}' not found`
      );
    }
    switch (outputSpec.extract.type) {
      case "stderr":
        return stderr;
      case "stdout":
        return stdout;
      case "regex":
        return this.readRegexOut(stdout, stderr, outputSpec.extract);
    }
  }

  private readRegexOut(
    stdout: string,
    stderr: string,
    { expr, groupName, stream }: Omit<RegexOutputSpec, "type">
  ): string {
    const readFrom = stream === "stderr" ? stderr : stdout;
    const regex: RegExp = typeof expr === "string" ? RegExp(expr, "gm") : expr;

    const result = regex.exec(readFrom);

    if (
      result == null ||
      result.groups == null ||
      !(groupName in result.groups)
    ) {
      throw new Error(`Unable to get the regexp: "${regex.source}"`);
    }

    return result.groups[groupName];
  }
}
