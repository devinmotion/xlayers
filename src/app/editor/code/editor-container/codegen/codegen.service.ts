import { Injectable } from '@angular/core';
import { AngularCodeGenService } from './angular/angular.service';
import { ReactCodeGenService } from './react/react.service';
import { VueCodeGenService } from './vue/vue.service';
import { WCCodeGenService } from './wc/wc.service';
import { StencilCodeGenService } from './stencil/stencil.service';
import { LitElementCodeGenService } from './lit-element/lit-element.service';
import { XamarinFormsCodeGenService } from './xamarin-forms/xamarin-forms.service';
import { Store } from '@ngxs/store';
import { UiState } from '@app/core/state';
import { environment } from '@env/environment.hmr';
import { CodeGenSettings } from '@app/core/state/page.state';


declare var gtag;

export interface XlayersNgxEditorModel {
  kind: 'angular' | 'react' | 'vue' | 'wc' | 'stencil' | 'litElement' |'html' | 'text' | 'xamarinForms';
  uri: string;
  value: string;
  language: string;
}

export interface XlayersExporterNavBar {
  stackblitz?: boolean;
}

export interface CodeGenFacade {
  buttons(): XlayersExporterNavBar;
  generate(ast: SketchMSLayer): Array<XlayersNgxEditorModel>;
}

export enum CodeGenKind {
  Unknown,
  Angular,
  React,
  Vue,
  WC,
  Stencil,
  LitElement,
  XamarinForms
}

@Injectable({
  providedIn: 'root'
})
export class CodeGenService {
  private ast: SketchMSLayer;

  constructor(
    private readonly angular: AngularCodeGenService,
    private readonly react: ReactCodeGenService,
    private readonly vue: VueCodeGenService,
    private readonly wc: WCCodeGenService,
    private readonly stencil: StencilCodeGenService,
    private readonly litElement: LitElementCodeGenService,
    private readonly xamarinForms: XamarinFormsCodeGenService,
    private readonly store: Store
  ) {
    this.store
      .select(UiState.currentPage)
      .subscribe((currentPage: SketchMSLayer) => {
        if (currentPage) {
          this.ast = this.generateCssClassNames(currentPage);
        }
      });
  }

  private addHeaderInfo(content: Array<XlayersNgxEditorModel>) {
    return content.map(file => {
      const message = 'File auto-generated by xLayers.app';
      const version = `Build: ${environment.version}`;
      const date = `Date: ${new Date().toLocaleString()}`;
      const comment = {
        start: '//',
        end: ''
      };
      if (file.language.includes('html')
       || file.language.includes('xaml')
       || file.language.includes('xml')) {
        comment.start = '<!--';
        comment.end = '-->';
      } else if (file.language.includes('css')) {
        comment.start = '/*';
        comment.end = '*/';
      }

      if (file.language.includes('xaml')) {
        const temp = file.value.trim().split('\n');
        file.value = [
          temp.shift(),
          `${comment.start} ${message} ${comment.end}`,
          `${comment.start} ${version} ${comment.end}`,
          `${comment.start} ${date} ${comment.end}`,
          '',
          ...temp
        ].join('\n');
      } else {
        file.value = [
          `${comment.start} ${message} ${comment.end}`,
          `${comment.start} ${version} ${comment.end}`,
          `${comment.start} ${date} ${comment.end}`,
          '',
          file.value
        ].join('\n');
      }

      return file;
    });
  }

  private generateCssClassNames(ast: SketchMSLayer) {
    function randomString() {
      return Math.random()
        .toString(36)
        .substring(2, 6);
    }

    function addCssClassNames(_ast: SketchMSLayer) {
      if (_ast.layers && _ast.layers.length > 0) {
        _ast.layers.forEach(layer => {
          if (layer.css) {
            (layer as any).css__className = `xly_${randomString()}`;
          }
          addCssClassNames(layer);
        });
      }
      return _ast;
    }

    return addCssClassNames(ast);
  }

  trackFrameworkKind(kind: CodeGenKind) {
    gtag('event', 'code_gen', {
      'event_category': 'web',
      'event_label': kind
    });
  }

  generate(kind: CodeGenKind): CodeGenSettings {
    switch (kind) {
      case CodeGenKind.Angular:
        this.trackFrameworkKind(CodeGenKind.Angular);
        return {
          kind,
          content: this.addHeaderInfo(this.angular.generate(this.ast)),
          buttons: this.angular.buttons()
        };
      case CodeGenKind.React:
        this.trackFrameworkKind(CodeGenKind.React);
        return {
          kind,
          content: this.addHeaderInfo(this.react.generate(this.ast)),
          buttons: this.react.buttons()
        };
      case CodeGenKind.Vue:
        this.trackFrameworkKind(CodeGenKind.Vue);
        return {
          kind,
          content: this.addHeaderInfo(this.vue.generate(this.ast)),
          buttons: this.vue.buttons()
        };
      case CodeGenKind.WC:
        this.trackFrameworkKind(CodeGenKind.WC);
        return {
          kind,
          content: this.addHeaderInfo(this.wc.generate(this.ast)),
          buttons: this.wc.buttons()
        };

      case CodeGenKind.Stencil:
      return {
        kind,
        content: this.addHeaderInfo(this.stencil.generate(this.ast)),
        buttons: this.stencil.buttons()
      };

      case CodeGenKind.LitElement:
      return {
        kind,
        content: this.addHeaderInfo(this.litElement.generate(this.ast)),
        buttons: this.litElement.buttons()
      };

      case CodeGenKind.XamarinForms:
      return {
        kind,
        content: this.addHeaderInfo(this.xamarinForms.generate(this.ast)),
        buttons: this.xamarinForms.buttons()
      };
    }
  }
}
