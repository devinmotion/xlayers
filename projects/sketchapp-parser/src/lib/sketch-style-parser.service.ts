import { BinaryPropertyListParserService } from './bplist-parser.service';
import { Injectable } from '@angular/core';

/**
 * border Type:
 * - 0: center
 * - 1: inside
 * - 2: outside
 */
export enum BorderType {
  INSIDE = 1,
  OUTSIDE = 2,
  CENTER = 0
}

export enum SupportScore {
  UNKNOWN = 1,
  DROPPED = 2,
  LEGACY = 3,
  LATEST = 4,
  EDGE = 5
}

@Injectable({
  providedIn: 'root'
})
export class SketchStyleParserService {
  version: SupportScore;

  constructor(private binaryPlistParser: BinaryPropertyListParserService) {}

  public visit(sketch: SketchMSData) {
    const supp = this.checkSupport(sketch);

    if (supp < SupportScore.DROPPED) {
      throw new Error('No longer supported version');
    }

    this.version = supp;

    sketch.pages.forEach(page => {
      this.autoFixPagePosition(page);
      this.enrichCSSStyle(page);
    });
    return supp;
  }

  checkSupport(sketch: SketchMSData) {
    const ver = Number.parseInt(sketch.meta.appVersion.split('.')[0], 10);
    if (Number.isNaN(ver)) {
      return SupportScore.UNKNOWN;
    } else if (ver < 49) {
      return SupportScore.DROPPED;
    } else if (ver >= 49 && ver < 52) {
      return SupportScore.LEGACY;
    } else if (ver >= 52) {
      return SupportScore.LATEST;
    } else {
      return SupportScore.EDGE;
    }
  }

  autoFixPagePosition(page: SketchMSPage) {
    if (
      page.frame.x !== 0 ||
      page.frame.y !== 0 ||
      (page.layers &&
        (page.layers[0].frame.x !== 0 || page.layers[0].frame.y !== 0))
    ) {
      page.frame.x = 0;
      page.frame.y = 0;

      if (page.layers[0]) {
        page.layers[0].frame.x = 0;
        page.layers[0].frame.y = 0;
      }
    }
  }

  enrichCSSStyle(page: SketchMSLayer) {
    this.visitLayers(page, page);
  }

  visitLayers(current: SketchMSLayer, root?: SketchMSLayer) {
    if (current.layers) {
      current.layers.map(layer => {
        if (layer.frame && layer.frame._class === 'rect') {
          this.visitObject(layer, current, layer);
          this.visitLayers(layer, layer);
        } else {
          this.visitLayers(layer, root);
        }
      });
    }
  }

  visitObject(current: SketchMSLayer, parent: SketchMSLayer, root: SketchMSLayer) {
    const obj = this.version >= SupportScore.LATEST
      ? this.parseObject(current, parent)
      : this.legacyParseObject(current);
    const attr = this.parseAttributeString(current);
    const grp = this.parseGroup(current);
    const pol = this.polyfill(current);

    this.setText(current, root, attr.text);
    this.setText(current, root, (obj as any).text);
    this.setText(current, root, pol.text);
    this.setSolid(current, root, (obj as any).shape);
    this.setStyle(current, root, obj.style);
    this.setStyle(current, root, grp.style);
  }

  /**
   * Parse attibutes
   */
  parseAttributeString(node: SketchMSLayer) {
    const obj = node.attributedString;
    if (obj && obj.hasOwnProperty('archivedAttributedString')) {
      const archive = this.binaryPlistParser.parse64Content(
        obj.archivedAttributedString._archive
      );
      if (archive) {
        switch (archive.$key) {
          case 'ascii':
            return {
              text: archive.$value
            };
        }
      }
    }
    return {};
  }

  /**
   * Parse high level wapper attributes
   */
  parseGroup(layer: SketchMSLayer) {
    return {
      style: (layer as SketchMSLayer).frame
        ? {
            display: 'block',
            position: 'absolute',
            left: `${layer.frame.x}px`,
            top: `${layer.frame.y}px`,
            width: `${layer.frame.width}px`,
            height: `${layer.frame.height}px`,
            visibility: layer.isVisible ? 'visible' : 'hidden'
          }
        : {}
    };
  }

  /**
   * Latest parse object attribute for 53 and higher
   */
  parseObject(layer: any, parent: any) {
    switch (layer._class) {
    case 'symbolMaster':
      return {
        style: {
          ...this.transformSymbolMaster(layer)
        }
      };

    case 'rectangle':
      return {
        style: {
          ...this.transformBlur(layer.style),
          ...this.transformBorders(layer.style),
          ...this.transformFills(layer.style),
          ...this.transformShadows(layer.style)
        }
      };

    case 'text':
      return {
        text: this.transformTextContent(layer),
        style: {
          ...this.transformTextColor(layer),
          ...this.transformParagraphStyle(layer),
          ...this.transformTextFont(layer)
        }
      };

    case 'oval':
      return {
        style: {
          ...this.transformOvalSolid(),
          ...this.transformBlur(layer.style),
          ...this.transformBorders(layer.style),
          ...this.transformFills(layer.style),
          ...this.transformShadows(layer.style)
        }
      };

      case 'shapePath':
        return parent._class !== 'shapeGroup'
        ? this.transformShapeSolid(layer, {
            ...this.transformFills(layer.style),
          })
        : {};

      case 'shapeGroup':
        return this.transformShapeGroup(layer, {
          ...this.transformFills(layer.style),
        });

    case 'triangle':
      return this.transformTriangleSolid(layer, {
        ...this.transformBorders(layer.style),
        ...this.transformFills(layer.style)
      });

    default:
      return {
        style: {
          ...(layer as SketchMSPage).rotation ? {
            transform: `rotate(${layer.rotation}deg)`
          } : {},
          ...(layer as SketchMSPage).fixedRadius ? {
            'border-radius': `${layer.fixedRadius}px`
          } : {},
          ...(layer as SketchMSGraphicsContextSettings).opacity ? {
            opacity: `${layer.opacity}`
          } : {}
        }
      };
    }
  }

  /**
   * Parse object attribute for 52 and lower
   */
  legacyParseObject(layer: any) {
    switch (layer._class) {
    case 'symbolMaster':
      return {
        style: {
          ...this.transformSymbolMaster(layer)
        }
      };

    case 'style':
      return {
        style: {
          ...this.transformBlur(layer),
          ...this.transformBorders(layer),
          ...this.transformFills(layer),
          ...this.transformShadows(layer)
        }
      };

    case 'text':
      return {
        text: this.transformTextContent(layer),
        style: {
          ...this.transformTextColor(layer),
          ...this.transformParagraphStyle(layer),
          ...this.transformTextFont(layer)
        }
      };

    default:
      return {
        style: {
          ...(layer as SketchMSPage).rotation ? {
            transform: `rotate(${layer.rotation}deg)`
          } : {},
          ...(layer as SketchMSPage).fixedRadius ? {
            'border-radius': `${layer.fixedRadius}px`
          } : {},
          ...(layer as SketchMSGraphicsContextSettings).opacity ? {
            opacity: `${layer.opacity}`
          } : {}
        }
      };
    }
  }

  /**
   * Best effort fallback polyfill
   */
  polyfill(layer: any) {
    return {
      text: layer.name
    };
  }

  transformSymbolMaster(node: SketchMSSymbolMaster) {
    const obj = node.backgroundColor;
    return {
      'background-color': this.parseColors(obj).rgba
    };
  }

  transformTextContent(node: SketchMSLayer) {
    return node.attributedString.string;
  }

  transformTriangleSolid(node: SketchMSPath, style: {[key: string]: string}) {
    const config = [];
    let offset = 0;

    // TODO: Support multiple border
    if (node.style.borders && node.style.borders.length > 0 && node.style.borders[0].thickness) {
      config.push(`stroke-width="${node.style.borders[0].thickness / 2}"`);
      const color = this.parseColors(node.style.borders[0].color);
      config.push(`stroke="${color.hex}"`);
      offset = node.style.borders[0].thickness;
    }

    const segments = (node as any).points
      .map(((curvePoint) => {
        const currPoint = this.parsePoint(curvePoint.point, offset / 2, node);
        return `${currPoint.x} ${currPoint.y}`;
      }))
      .join(' ');

      if (node.style.fills && node.style.fills.length > 0) {
        config.push(`fill="${this.parseColors(node.style.fills[0].color).hex.slice(0, -2)}"`);
      } else {
        config.push('fill="none"');
      }

    const svg = [
      `<polygon`,
      ...config,
      `points="${segments}"`,
      '/>'
    ];

    return this.svgCanvas(node, offset, svg.join(' '));
  }

  transformOvalSolid() {
    return {
      'border-radius': '50%'
    };
  }

  transformShapeSolid(node: SketchMSPath, style: {[key: string]: string}) {
    const config = [];
    let offset = 0;

    // TODO: Support multiple border
    if (node.style.borders && node.style.borders.length > 0 && node.style.borders[0].thickness) {
      config.push(`stroke-width="${node.style.borders[0].thickness / 2}"`);
      const color = this.parseColors(node.style.borders[0].color);
      config.push(`stroke="${color.hex}"`);
      offset = node.style.borders[0].thickness;
    }

    // TODO: move to @types/sketchapp
    const origin = this.parsePoint((node as any).points[0].point, offset, node);
    const segments = (node as any).points
      .slice(1)
      .map(((curvePoint) => {
        const curveFrom = this.parsePoint(curvePoint.curveFrom, offset, node);
        const curveTo = this.parsePoint(curvePoint.curveTo, offset, node);
        const currPoint = this.parsePoint(curvePoint.point, offset, node);
        if (curveTo.x === curveFrom.x && curveTo.y === curveFrom.y) {
          return `L ${currPoint.x} ${currPoint.y}`;
        }
        return `S ${curveTo.x} ${curveTo.y} ${currPoint.x} ${currPoint.y}`;
      }));

    segments.unshift(`M${origin.x} ${origin.y}`);

    if (node.isClosed) {
      segments.push('z');
    }

    if (node.style.fills && node.style.fills.length > 0) {
      config.push(`fill="${this.parseColors(node.style.fills[0].color).hex.slice(0, -2)}"`);
    } else {
      config.push('fill="none"');
    }

    const svg = [
      `<path`,
      ...config,
      `d="${segments.join(' ')}"`,
      '/>'
    ];

    return this.svgCanvas(node, offset, svg.join(' '));
  }

  transformShapeGroup(node: SketchMSPath, style: {[key: string]: string}) {
    const offset = 0;
    const paths = node.layers.map((layer) => {
      // TODO: move to @types/sketchapp
      const origin = this.parsePoint((layer as any).points[0].point, offset, layer);
      const segments = (layer as any).points
        .slice(1)
        .map(((curvePoint) => {
          const curveFrom = this.parsePoint(curvePoint.curveFrom, offset, layer);
          const curveTo = this.parsePoint(curvePoint.curveTo, offset, layer);
          const currPoint = this.parsePoint(curvePoint.point, offset, layer);
          if (curveTo.x === curveFrom.x && curveTo.y === curveFrom.y) {
            return `L ${layer.frame.x + currPoint.x} ${layer.frame.y + currPoint.y}`;
          }
          return `S ${layer.frame.x + curveTo.x} ${layer.frame.y + curveTo.y}, ${layer.frame.x + currPoint.x} ${layer.frame.y + currPoint.y}`;
        }));

      segments.unshift(`M${layer.frame.x + origin.x} ${layer.frame.y + origin.y}`);

      // TODO: isClosed to type
      if ((layer as any).isClosed) {
        segments.push('z');
      }

      return segments.join(' ');
    });

    const embeddedStyle = [];

    if (style['background-color']) {
      embeddedStyle.push(`fill: ${style['background-color']}`);
    } else {
      embeddedStyle.push('fill: none');
    }

    const svg = [
      `<path`,
      `style="${embeddedStyle.join(' ')}"`,
      `d="${paths.join(' ')}"`,
      '/>'
    ];

    return this.svgCanvas(node, offset, svg.join(' '));
  }

  transformTextFont(node: SketchMSLayer) {
    const obj =
      node.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute;
    if (obj.hasOwnProperty('_class') && obj._class === 'fontDescriptor') {
      return {
        'font-family': `'${obj.attributes.name}', 'Roboto', 'sans-serif'`,
        'font-size': `${obj.attributes.size}px`
      };
    } else if (obj.hasOwnProperty('_archive')) {
      // TODO: Handle legacy
      // const archive = this.binaryPlistParser.parse64Content(obj._archive);
      // (scope.style.textStyle.encodedAttributes.MSAttributedStringFontAttribute as any)._transformed = archive;
      return {};
    }
    return {};
  }

  transformParagraphStyle(node: SketchMSLayer) {
    const obj = node.style.textStyle.encodedAttributes;
    if (obj.hasOwnProperty('NSParagraphStyle')) {
      // TODO: Handle legacy
      // const archive = this.binaryPlistParser.parse64Content(scope.style.textStyle.encodedAttributes.NSParagraphStyle._archive);
      // (scope.style.textStyle.encodedAttributes.NSParagraphStyle as any)._transformed = archive;
      return {};
    }
    return {};
  }

  transformTextColor(node: SketchMSLayer) {
    const obj = node.style.textStyle.encodedAttributes;
    if (obj.hasOwnProperty('MSAttributedStringColorAttribute')) {
      return {
        color: this.parseColors(obj.MSAttributedStringColorAttribute).rgba
      };
    } else if (obj.hasOwnProperty('NSColor')) {
      // TODO: Handle legacy
      // const archive = this.binaryPlistParser.parse64Content(obj.NSColor._archive);
      // (scope.style.textStyle.encodedAttributes.NSColor as any)._transformed = archive;
      return {};
    }
    return {
      color: 'black'
    };
  }

  transformBlur(node: SketchMSStyle) {
    const obj = node.blur;
    return obj && obj.radius > 0
      ? {
          filter: `blur(${obj.radius}px);`
        }
      : {};
  }

  transformBorders(node: SketchMSStyle) {
    const obj = node.borders;
    if (!obj || obj.length === 0) {
      return {};
    }

    const bordersStyles = obj.reduce((acc, border) => {
      if (border.thickness > 0) {
        const color = this.parseColors(border.color);
        let shadow = `0 0 0 ${border.thickness}px ${color.rgba}`;
        if (border.position === BorderType.INSIDE) {
          shadow += ' inset';
        }
        return [shadow, ...acc];
      }
      return acc;
    }, []);

    return bordersStyles.length > 0
      ? {
          'box-shadow': bordersStyles.join(',')
        }
      : {};
  }

  transformFills(node: SketchMSStyle) {
    const obj = node.fills;
    if (!obj || obj.length === 0) {
      return {};
    }

    // we only support one fill: take the first one!
    // ignore the other fills
    const firstFill = obj[0];

    if (!firstFill.isEnabled) {
      return {};
    }

    return {
      ...(() => {
        if (firstFill.gradient) {
          const fillsStyles: string[] = [];
          firstFill.gradient.stops.forEach(stop => {
            let fill = `${this.parseColors(stop.color).rgba}`;
            if (stop.position >= 0 && stop.position <= 1) {
              fill += ` ${stop.position * 100}%`;
            }
            fillsStyles.push(fill);
          });

          if (fillsStyles.length > 0) {
            // apply gradient, if multiple fills
            // default angle is 90deg
            return {
              background: `linear-gradient(90deg, ${fillsStyles.join(',')})`
            };
          }
        }
      })(),
      'background-color': `${this.parseColors(firstFill.color).rgba}`
    };
  }

  transformShadows(node: SketchMSStyle) {
    const innerShadows = node.innerShadows;
    const shadows = node.shadows;
    const shadowsStyles: string[] = [];

    if (innerShadows) {
      innerShadows.forEach(innerShadow => {
        const color = this.parseColors(innerShadow.color);
        shadowsStyles.push(
          `${innerShadow.offsetX}px ${innerShadow.offsetY}px ${
            innerShadow.blurRadius
          }px ${innerShadow.spread}px ${color.rgba} inset`
        );
      });
    }
    if (shadows) {
      shadows.forEach(shadow => {
        const color = this.parseColors(shadow.color);
        shadowsStyles.push(
          `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blurRadius}px ${
            shadow.spread
          }px ${color.rgba}`
        );
      });
    }

    return shadowsStyles.length > 0
      ? {
          'box-shadow': shadowsStyles.join(',')
        }
      : {};
  }

  parseStroke(node: SketchMSLayer) {
    const config = [];

    // TODO: Support multiple border
    if (node.style.borders && node.style.borders[0].thickness) {
      config.push(`stroke-width="${node.style.borders[0].thickness}"`);
      const color = this.parseColors(node.style.borders[0].color);
      config.push(`stroke="${color.hex}"`);
    }

    return config;
  }

  svgCanvas(node: SketchMSPath, offset: number, paths: string) {
    return {
      shape: `<svg width="${node.frame.width + offset}" height="${node.frame.height + offset}">${paths}</svg>`,
      style: {
        position: 'absolute',
        top: `${-offset}px`,
        left: `${-offset}px`
      }
    };
  }

  parsePoint(point: string, offset: number, node: SketchMSPath) {
    const parsedPoint = point.slice(1, -1).split(', ');
    return {
      x: Number.parseFloat((node.frame.width * Number.parseFloat(parsedPoint[0]) + offset).toFixed(3)),
      y: Number.parseFloat((node.frame.height * Number.parseFloat(parsedPoint[1]) + offset).toFixed(3))
    };
  }

  parseColors(color: SketchMSColor) {
    const { red, green, blue, alpha } = color;
    return {
      hex: this.sketch2hex(red, green, blue, alpha),
      rgba: this.sketch2rgba(red, green, blue, alpha),
      raw: {
        red: this.rgba(red),
        green: this.rgba(green),
        blue: this.rgba(blue),
        alpha
      }
    };
  }

  rgba(v: number) {
    const color = Math.round(v * 255);
    return color > 0 ? color : 0;
  }

  sketch2rgba(r: number, g: number, b: number, a: number) {
    return `rgba(${this.rgba(r)},${this.rgba(g)},${this.rgba(b)},${a})`;
  }

  sketch2hex(r: number, g: number, b: number, a: number) {
    if (r > 255 || g > 255 || b > 255 || a > 255) {
      return '';
    }
    return (
      '#' +
      ((256 + this.rgba(r)).toString(16).substr(1) +
        (
          ((1 << 24) + (this.rgba(g) << 16)) |
          (this.rgba(b) << 8) |
          this.rgba(a)
        )
          .toString(16)
          .substr(1))
    );
  }

  setStyle(obj: any, root: any, style: { [key: string]: string }) {
    root.css = root.css || {};
    obj.css = obj.css || {};
    for (const property in style) {
      if (style.hasOwnProperty(property)) {
        root.css[property] = style[property];
        obj.css[property] = style[property];
      }
    }
  }

  setText(obj: any, root: any, text: string) {
    if (text && (!root.text || !obj.text)) {
      root.text = text;
      obj.text = text;
    }
  }

  setSolid(obj: any, root: any, shape: string) {
    if (shape && (!root.shape || !obj.shape)) {
      root.shape = shape;
      obj.shape = shape;
    }
  }
}
