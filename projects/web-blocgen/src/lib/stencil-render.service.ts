import { Injectable } from "@angular/core";
import { FormatService } from "@xlayers/sketch-lib";
import { WebRenderService } from "./web-render.service";
import { WebBlocGenOptions } from "./web-blocgen";

@Injectable({
  providedIn: "root"
})
export class StencilRenderService {
  constructor(
    private format: FormatService,
    private webRender: WebRenderService
  ) {}

  render(current: SketchMSLayer, options: WebBlocGenOptions) {
    const fileName = this.format.fileName(current.name);
    const files = this.webRender.render(current, options);
    const html = files.find(file => file.language === "html");

    return [
      files.filter(file => file.language !== "html"),
      {
        kind: "stencil",
        value: this.renderE2e(name).join("\n"),
        language: "typescript",
        uri: `${options.componentDir}/${fileName}.e2e.ts`
      },
      {
        kind: "stencil",
        value: this.renderComponent(html.value, options).join("\n"),
        language: "typescript",
        uri: `${options.componentDir}/${fileName}.tsx`
      }
    ];
  }

  private renderComponent(html: string, options: WebBlocGenOptions) {
    const fileName = this.format.fileName(name);
    const componentName = this.format.componentName(name);
    const tagName = this.format.fileName(name);

    return [
      "import { Component } from '@angular/core';",
      `import ${componentName} from "./${options.componentDir}/${fileName}";`,
      "",
      "@Component({",
      `  selector: '${options.xmlPrefix}${tagName}',`,
      `  styleUrl: './${fileName}.component.css'`,
      "  shadow: true",
      "})",
      `export class ${componentName}Component {`,
      "  render() {",
      "    return (",
      ...this.format.indentFile(3, html),
      "    );",
      "  }",
      "}"
    ];
  }

  private renderE2e(name: string) {
    const componentName = this.format.componentName(name);
    const tagName = this.format.fileName(name);

    return [
      `describe('${componentName}', () => {`,
      "  it('renders', async () => {",
      "    const page = await newE2EPage();",
      "",
      `    await page.setContent('<${tagName}></${tagName}>');`,
      `    const element = await page.find('${tagName}');`,
      `    expect(element).toHaveClass('hydrated');`,
      "  });",
      "});"
    ];
  }
}
