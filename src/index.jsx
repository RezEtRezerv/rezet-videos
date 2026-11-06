import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Promo, FPS, totalFrames } from './Promo.jsx';

const Root = () => (
  <Composition
    id="Promo"
    component={Promo}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={300}
    defaultProps={{ scenes: [], url: '' }}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(30, totalFrames(props.scenes)) })}
  />
);
registerRoot(Root);
