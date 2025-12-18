import './index.less';

export interface ContentScriptState {
  color: string;
  visible: boolean;
  animate: boolean;
  recording: boolean;
  activeFrame: number;
}

export interface FrameInfo {
  frameId: number;
}

export interface PageInfo {
  frameId: number;
  pageURL: string;
  isInFrame: boolean;
}

export interface PanelIntercom {
  command:
    | 'setState'
    | 'reset'
    | 'inspectElement'
    | 'registerFrame'
    | 'pageLoaded';
  payload?: ContentScriptState | PageInfo;
}

class NerdeRegionPanel {
  constructor() {}

  init(): void {}
}

const nerdeRegionPanel = new NerdeRegionPanel();
nerdeRegionPanel.init();
