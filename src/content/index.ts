import {
  ContentScriptState,
  PanelIntercom,
  FocusState,
  FrameInfo,
  PageInfo,
} from '../panel';

interface indicatorStyle {
  height: number;
  width: number;
  left: number;
  top: number;
  outline: string;
  position: string;
  boxShadow: string;
  borderRadius: string;
  zIndex: string;
  outlineOffset: string;
  pointerEvents: string;
  transition: string;
}

class NerdeFocusCS {
  private activeElement: Element | null;
  private animateIndicator: boolean;
  private captureFocus: boolean;
  private indicatorColor: string;
  private readonly inFrame: boolean;
  private showIndicator: boolean;
  private readonly borderWidth: number;
  private readonly borderOffset: number;
  private readonly indicatorStyle: indicatorStyle;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private frameId: number;
  private resetChecker: number;

  constructor() {
    this.animateIndicator = true;
    this.showIndicator = false;
    this.indicatorColor = '#FF0000';
    this.captureFocus = false;
    this.activeElement = null;
    this.inFrame = window.self !== window.top;
    this.frameId = this.inFrame ? -1 : 0;
    this.borderWidth = 3;
    this.borderOffset = 1;
    this.indicatorStyle = {
      height: 0,
      width: 0,
      left: 0,
      top: 0,
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: this.animateIndicator ? 'all 0.2s ease-in-out' : 'none',
      outline: `${this.borderWidth}px solid ${this.indicatorColor}`,
      position: 'fixed',
      boxShadow: `0 0 0 ${
        this.borderOffset * 2 + this.borderWidth
      }px #FFFFFF80`,
      borderRadius: `${this.borderOffset}px`,
      outlineOffset: `${this.borderOffset}px`,
    } as indicatorStyle;
    this.resetChecker = 0;
    this.intersectionObserver = new IntersectionObserver(
      () => {
        this.updateIndicator();
      },
      { root: this.getIndicator(), rootMargin: '0px', threshold: 1.0 }
    );
    this.resizeObserver = new ResizeObserver(() => {
      this.updateIndicator();
    });
    this.mutationObserver = new MutationObserver(() => {
      this.updateIndicator();
    });
  }

  /**
   * Calculates a simple CSS path for a given element in DOM
   * Based on https://github.com/yamadapc/jquery-getpath
   * Based on https://github.com/dequelabs/axe-core/blob/develop/lib/core/utils/get-selector.js
   */
  getPath(node: HTMLElement | null): string {
    const commonNames = [
      'selected',
      'active',
      'focus',
      'hover',
      'enable',
      'hidden',
      'visible',
      'valid',
      'disable',
      'col-',
    ];
    /**
     * Returns an array of sibling elements for the given HTML element
     * @param element - The HTML element to find siblings for
     * @returns Array of sibling elements, excluding the input element
     */
    const getSiblings = (element: HTMLElement): Element[] => {
      const ELEMENT_NODE_TYPE = 1;

      if (!element?.parentNode) {
        return [];
      }

      const parent = element.parentNode;
      return Array.from(parent.children).filter(
        (sibling) => sibling.nodeType === ELEMENT_NODE_TYPE
      );
    };

    const path: Array<string> = [];

    let currentNode: HTMLElement | null = node;

    while (currentNode) {
      const nodeTag = currentNode.localName.toLowerCase() || null;
      const nodeParent: HTMLElement | null = currentNode.parentElement;

      if (!nodeTag || !nodeParent) {
        break;
      }

      if (nodeTag === 'body') {
        path.push(nodeTag);
        break;
      }

      // Check if we can use a unique id for selector
      if (
        currentNode.id &&
        /^[A-Za-z][\da-zA-Z_-]*$/.test(currentNode.id) &&
        document.querySelectorAll(`#${currentNode.id}`).length === 1
      ) {
        path.push(`#${currentNode.id}`);
        break;
      }

      // Check if we can use a unique class name for selector
      const classList = Array.from(currentNode.classList).filter(
        (className) =>
          /^[\da-zA-Z_-]*$/.test(className) && !commonNames.includes(className)
      );

      const isUnique = classList.some((className) => {
        if (document.querySelectorAll(`${nodeTag}.${className}`).length === 1) {
          path.push(`${nodeTag}.${className}`);
          return true;
        }
        return false;
      });

      if (isUnique) {
        break;
      }

      // Try using a nth child selector if no unique matches are found
      const siblingNodes = getSiblings(currentNode);

      if (siblingNodes && siblingNodes.length <= 1) {
        path.push(nodeTag);
      } else {
        const siblingIndex = siblingNodes.indexOf(currentNode);
        path.push(
          siblingIndex ? `${nodeTag}:nth-child(${siblingIndex + 1})` : nodeTag
        );
      }

      currentNode = nodeParent;
    }

    return path.reverse().join(' > ');
  }

  getIndicator(): HTMLElement | null {
    return document.querySelector('#nerdeFocusIndicator');
  }

  getBoundingRect(): indicatorStyle {
    if (!this.activeElement) {
      return this.indicatorStyle;
    }

    const rect = this.activeElement.getBoundingClientRect();
    return Object.assign(this.indicatorStyle, {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    });
  }

  setState(state: ContentScriptState): void {
    this.indicatorColor = state.color;
    this.animateIndicator = state.animate;
    this.captureFocus = state.recording;
    this.showIndicator = state.visible;

    if (this.showIndicator) {
      this.updateFocus();
      this.insertIndicator();
    } else {
      this.removeIndicator();
    }

    this.updateIndicator();
  }

  isVisuallyHidden(node: HTMLElement | null): boolean {
    let currentNode: HTMLElement | null = node;

    while (currentNode) {
      const nodeParent: HTMLElement | null = currentNode.parentElement;
      if (!nodeParent) {
        break;
      }

      const nodeStyle = window.getComputedStyle(currentNode);

      if (
        (currentNode.offsetHeight <= 8 || currentNode.offsetWidth <= 8) &&
        (nodeStyle.overflow === 'hidden' ||
          nodeStyle.overflowX === 'hidden' ||
          nodeStyle.overflowY === 'hidden' ||
          nodeStyle.clipPath === 'rect(0px, 0px, 0px, 0px)')
      ) {
        return true;
      }
      currentNode = nodeParent;
    }
    return false;
  }

  sendFocusState(): void {
    chrome?.runtime?.sendMessage({
      command: 'updateFocus',
      payload: {
        itemPath: this.getPath(this.activeElement as HTMLElement),
        itemTag: this.activeElement?.tagName,
        isVisuallyHidden: this.isVisuallyHidden(
          this.activeElement as HTMLElement
        ),
        isInFrame: this.inFrame,
      } as FocusState,
    } as PanelIntercom);
  }

  sendPageLoad(): void {
    chrome?.runtime?.sendMessage({
      command: 'pageLoaded',
      payload: {
        isInFrame: this.inFrame,
        pageURL: window.location.href,
      } as PageInfo,
    } as PanelIntercom);
  }

  registerListeners(): void {
    window.addEventListener(
      'focus',
      () => {
        this.updateFocus();
      },
      true
    );
    window.addEventListener(
      'blur',
      () => {
        this.checkReset();
      },
      true
    );
    window.addEventListener(
      'scroll',
      () => {
        this.updateIndicator(true);
      },
      true
    );
    window.addEventListener(
      'resize',
      () => {
        this.updateIndicator(true);
      },
      true
    );
  }

  registerFrame(): void {
    if (this.frameId >= 0) {
      return;
    }

    chrome?.runtime?.sendMessage(
      {
        command: 'registerFrame',
      } as PanelIntercom,
      (response: FrameInfo) => {
        this.frameId = response.frameId;
      }
    );
  }

  inspectElement(CssPath: string): void {
    if (document.querySelector(CssPath)) {
      chrome?.devtools?.inspectedWindow?.eval(
        `inspect(document.querySelector(${CssPath}))`
      );
    }
  }

  checkReset(): void {
    if ((!this.showIndicator && !this.captureFocus) || this.inFrame) {
      return;
    }

    if (this.resetChecker) {
      clearTimeout(this.resetChecker);
    }

    this.resetChecker = setTimeout(() => {
      if (document.activeElement?.tagName === 'BODY') {
        this.updateFocus();
      }
    }, 250);
  }

  updateFocus(): void {
    if (!this.captureFocus && !this.showIndicator) {
      return;
    }

    const activeElement = document.activeElement;
    if (this.activeElement === activeElement) {
      return;
    }

    this.activeElement = activeElement;
    this.sendFocusState();

    if (!this.showIndicator) {
      return;
    }

    this.updateIndicator(false);
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(this.activeElement as HTMLElement);
    this.intersectionObserver.disconnect();
    this.intersectionObserver.observe(this.activeElement as HTMLElement);
    this.mutationObserver.disconnect();
    this.mutationObserver.observe(this.activeElement as HTMLElement, {
      attributes: true,
      childList: false,
      subtree: false,
    });
  }

  updateIndicator(suppressAnimation: boolean = false): void {
    if (!this.showIndicator || !this.activeElement) {
      return;
    }

    const elementBox = this.getBoundingRect();
    const { clientWidth, clientHeight } = window.document.documentElement;
    const borderOffset = this.borderWidth + this.borderOffset;

    elementBox.width = Math.max(elementBox.width, this.borderWidth * 3);
    elementBox.width = Math.min(
      elementBox.width,
      clientWidth - borderOffset * 2
    );

    elementBox.height = Math.max(elementBox.height, this.borderWidth * 3);
    elementBox.height = Math.min(
      elementBox.height,
      clientHeight - borderOffset * 2
    );

    const isBody = this.activeElement.tagName === 'BODY';

    elementBox.left = Math.max(
      elementBox.left,
      isBody ? borderOffset : -elementBox.width
    );
    elementBox.top = Math.max(
      elementBox.top,
      isBody ? borderOffset : -elementBox.height
    );
    elementBox.left = Math.min(elementBox.left, clientWidth);
    elementBox.top = Math.min(elementBox.top, clientHeight);

    elementBox.outline = `${this.borderWidth}px solid ${this.indicatorColor}`;
    elementBox.transition =
      !suppressAnimation && this.animateIndicator
        ? 'all 200ms ease-in-out'
        : 'all 10ms ease-in';

    const indicator = this.getIndicator();
    if (!indicator) {
      return;
    }

    Object.assign(
      indicator.style,
      Object.fromEntries(
        Object.entries(elementBox).map(([key, value]) => [
          key,
          typeof value === 'number' ? `${value}px` : value,
        ])
      )
    );
  }

  insertIndicator(): void {
    const indicatorTemplate = `<div id="nerdeFocusIndicator"></div>`;
    this.removeIndicator();
    const body: HTMLElement | null = document.querySelector('body');
    if (body) {
      body.insertAdjacentHTML('beforeend', indicatorTemplate);
    }
    this.updateIndicator();
  }

  removeIndicator(): void {
    const indicator = this.getIndicator();
    if (indicator) {
      indicator.remove();
    }
  }

  init(): void {
    chrome?.runtime?.onMessage.addListener(
      (request: PanelIntercom, sender, sendResponse) => {
        switch (request.command) {
          case 'setState':
            this.setState(request.payload as ContentScriptState);
            break;
          default:
            break;
        }
      }
    );

    this.registerFrame();
    this.registerListeners();
    this.sendPageLoad();
    this.updateFocus();
  }
}

const nerdeFocusCS = new NerdeFocusCS();
nerdeFocusCS.init();
