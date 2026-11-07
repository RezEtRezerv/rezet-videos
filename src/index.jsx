import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Promo, FPS, totalFrames } from './Promo.jsx';
import { Cover } from './Cover.jsx';
import { FbCover } from './FbCover.jsx';

const Root = () => (
  <>
  <Composition id="FbCover" component={FbCover} width={1640} height={624} fps={30} durationInFrames={1} />
  <Composition id="Cover" component={Cover} width={1128} height={191} fps={30} durationInFrames={1} />
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
  </>
);
registerRoot(Root);
