import { Injectable } from '@angular/core';
import { WebCodeGenService } from '@xlayers/web-codegen';

@Injectable({
  providedIn: 'root'
})
export class VueCodeGenService {
  constructor(private readonly webCodeGen: WebCodeGenService) {}

  buttons() {
    return {};
  }

  generate(data: SketchMSData) {
    return [
      {
        kind: 'text',
        value: this.renderReadme(data.meta.app),
        language: 'markdown',
        uri: `README.md`
      },
      ...data.pages.flatMap(page =>
        this.webCodeGen.aggreate(page, data, { mode: 'vue' })
      )
    ];
  }

  private renderReadme(name: string) {
    return `\
## How to use the ${name} Vue module

1. Download and extract the exported module into your workspace,

2. Import the component into your App component or other container.
\`\`\`
<template>
  <div id="app">
    <MyComponent />
  </div>
</template>

<script>
import MyComponent from \'./components/MyComponent.vue\'

export default {
  name: \'app\
  components: {
    MyComponent
  }
}
</script>
\`\`\`

3. Enjoy.`;
  }
}
