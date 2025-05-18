import './index.less';
import { FrameInfo, PanelIntercom } from '../panel';

class NerdeFocusPopUp {
  constructor() {}

  init(): void {
    chrome?.runtime?.onMessage.addListener(
      (request: PanelIntercom, sender, sendResponse) => {}
    );
  }
}

const nerdeFocusPopUp = new NerdeFocusPopUp();
nerdeFocusPopUp.init();
