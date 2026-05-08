import { Pipe } from "@angular/core";
import { ProviderUtils } from "@shared/utils/provider.utils";

@Pipe({ name: "formatBytes", standalone: true })
export class FormatBytesPipe {
  private providerUtils = new ProviderUtils();
  transform(bytes: number): string {
    return this.providerUtils.formatBytes(bytes);
  }
}
