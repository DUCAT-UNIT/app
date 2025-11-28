// Mock for react-native-svg - renders actual SVG elements for web
import React from 'react';

// Map react-native-svg props to web SVG props
const mapProps = (props: Record<string, unknown>) => {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Convert camelCase to kebab-case for SVG attributes
    if (key === 'strokeWidth') mapped['strokeWidth'] = value;
    else if (key === 'strokeLinecap') mapped['strokeLinecap'] = value;
    else if (key === 'strokeLinejoin') mapped['strokeLinejoin'] = value;
    else if (key === 'strokeDasharray') mapped['strokeDasharray'] = value;
    else if (key === 'fillRule') mapped['fillRule'] = value;
    else if (key === 'clipRule') mapped['clipRule'] = value;
    else if (key === 'viewBox') mapped['viewBox'] = value;
    else mapped[key] = value;
  }
  return mapped;
};

const createSvgComponent = (tagName: string) => {
  const Component = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(tagName, mapProps(props), children);
  Component.displayName = tagName;
  return Component;
};

export const Svg = createSvgComponent('svg');
export const Circle = createSvgComponent('circle');
export const Ellipse = createSvgComponent('ellipse');
export const G = createSvgComponent('g');
export const Text = createSvgComponent('text');
export const TSpan = createSvgComponent('tspan');
export const TextPath = createSvgComponent('textPath');
export const Path = createSvgComponent('path');
export const Polygon = createSvgComponent('polygon');
export const Polyline = createSvgComponent('polyline');
export const Line = createSvgComponent('line');
export const Rect = createSvgComponent('rect');
export const Use = createSvgComponent('use');
export const Image = createSvgComponent('image');
export const Symbol = createSvgComponent('symbol');
export const Defs = createSvgComponent('defs');
export const LinearGradient = createSvgComponent('linearGradient');
export const RadialGradient = createSvgComponent('radialGradient');
export const Stop = createSvgComponent('stop');
export const ClipPath = createSvgComponent('clipPath');
export const Pattern = createSvgComponent('pattern');
export const Mask = createSvgComponent('mask');
export const ForeignObject = createSvgComponent('foreignObject');

export default Svg;
