import { PanelIntercom, FrameInfo } from '../panel';

chrome?.runtime?.onMessage.addListener(
  (request: PanelIntercom, sender, sendResponse) => {
    if (request.command === 'registerFrame') {
      sendResponse({ frameId: sender.frameId } as FrameInfo);
    }
  }
);
