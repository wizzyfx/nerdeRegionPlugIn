import {
  ContentScriptState,
  PanelIntercom,
  FrameInfo,
  PageInfo,
} from '../panel';

class NerdeRegionCS {
  private positiveLookUp: string[];
  private negativeLookUp: string[];
  private inFrame: boolean;

  constructor() {
    this.positiveLookUp = [
      '[aria-live="polite"]',
      '[aria-live="assertive"]',
      '[role="alert"]',
      '[role="log"]',
      '[role="status"]',
    ];
    this.negativeLookUp = ['[aria-live="off"]'];
    this.inFrame = window.self !== window.top;
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

  /**
   * Calculates the accessible name of a node based on W3C name calculation spec
   * https://www.w3.org/TR/accname-1.1/
   * https://www.w3.org/TR/html-aam-1.0/#accessible-name-and-description-computation
   */
  getAccessibleName(node: HTMLElement | null): string {
    if (!node) return '';

    // Initialize computation context
    const context = {
      visited: new Set<HTMLElement>(),
      rootNode: node,
      isLabelTraversal: false,
      isAriaLabelledByTraversal: false,
      isAriaDescribedByTraversal: false,
      isRecursion: false
    };

    return this.computeAccessibleName(node, context).trim();
  }

  /**
   * Core accessible name computation algorithm following W3C specification
   */
  private computeAccessibleName(currentNode: HTMLElement, context: any): string {
    // Step 1: Handle circular references - Each node consulted only once
    if (!context.isAriaLabelledByTraversal && context.visited.has(currentNode)) {
      return '';
    }
    
    if (!context.isAriaLabelledByTraversal) {
      context.visited.add(currentNode);
    }

    // Step 2.A: Hidden check - Skip if hidden and not directly referenced
    if (!context.isAriaLabelledByTraversal && !context.isAriaDescribedByTraversal && !context.isLabelTraversal) {
      if (this.isHiddenFromAccessibilityTree(currentNode)) {
        return '';
      }
    }

    // Step 2.B: aria-labelledby processing (computing name only)
    if (!context.isAriaLabelledByTraversal) {
      const ariaLabelledByValue = currentNode.getAttribute('aria-labelledby');
      if (ariaLabelledByValue?.trim()) {
        const referencedTexts: string[] = [];
        const ids = ariaLabelledByValue.split(/\s+/);
        
        for (const id of ids) {
          const trimmedId = id.trim();
          if (trimmedId) {
            const referencedElement = document.getElementById(trimmedId);
            if (referencedElement) {
              const childContext = {
                ...context,
                isAriaLabelledByTraversal: true,
                visited: new Set(context.visited)
              };
              const referencedText = this.computeAccessibleName(referencedElement, childContext);
              referencedTexts.push(referencedText);
            }
          }
        }
        
        return referencedTexts.join(' ');
      }
    }

    // Step 2.C: aria-label processing
    if (!context.isRecursion || !this.isEmbeddedControl(currentNode)) {
      const ariaLabel = currentNode.getAttribute('aria-label')?.trim();
      if (ariaLabel) {
        return ariaLabel;
      }
    }

    // Step 2.D: Native markup text alternatives
    if (!this.isPresentationalRole(currentNode)) {
      const nativeTextAlternative = this.getNativeTextAlternative(currentNode, context);
      if (nativeTextAlternative) {
        return nativeTextAlternative;
      }
    }

    // Step 2.E: Embedded control handling
    if (context.isLabelTraversal || context.isAriaLabelledByTraversal) {
      const embeddedControlValue = this.getEmbeddedControlValue(currentNode);
      if (embeddedControlValue) {
        return embeddedControlValue;
      }
    }

    // Step 2.F: Text content from children (name from content)
    if (this.allowsNameFromContent(currentNode) || 
        context.isAriaLabelledByTraversal || 
        context.isAriaDescribedByTraversal || 
        context.isLabelTraversal) {
    
      return this.getTextFromContent(currentNode, context);
    }

    // Step 2.G: Text node content
    if (currentNode.nodeType === Node.TEXT_NODE) {
      return currentNode.nodeValue?.trim() || '';
    }

    // Step 2.H: Fallback to tooltip (title attribute)
    const title = currentNode.getAttribute('title');
    if (title?.trim()) {
      return title.trim();
    }

    return '';
  }

  /**
   * Check if element is hidden from accessibility tree
   */
  private isHiddenFromAccessibilityTree(element: HTMLElement): boolean {
    // Check CSS visibility
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }

    // Check aria-hidden
    if (element.getAttribute('aria-hidden') === 'true') {
      return true;
    }

    return false;
  }

  /**
   * Check if element has presentational role
   */
  private isPresentationalRole(element: HTMLElement): boolean {
    const role = element.getAttribute('role');
    return role === 'presentation' || role === 'none';
  }

  /**
   * Get native text alternative from host language
   */
  private getNativeTextAlternative(element: HTMLElement, context: any): string {
    const tagName = element.tagName.toLowerCase();
    
    // Input elements
    if (tagName === 'input') {
      const inputElement = element as HTMLInputElement;
      const type = inputElement.type.toLowerCase();

      // Handle labels for labelable elements
      if (this.isLabelableElement(element)) {
        const labelText = this.getLabelText(element, context);
        if (labelText) {
          return labelText;
        }
      }

      // Input type specific handling
      switch (type) {
        case 'button':
        case 'submit':
        case 'reset':
          return inputElement.value || this.getDefaultButtonText(type);
        case 'image':
          return inputElement.alt || inputElement.value || inputElement.title || '';
      }
    }

    // Image elements
    if (tagName === 'img') {
      const imgElement = element as HTMLImageElement;
      return imgElement.alt || '';
    }

    // Area elements
    if (tagName === 'area') {
      const areaElement = element as HTMLAreaElement;
      return areaElement.alt || '';
    }

    // Handle other labelable elements
    if (this.isLabelableElement(element)) {
      const labelText = this.getLabelText(element, context);
      if (labelText) {
        return labelText;
      }
    }

    return '';
  }

  /**
   * Get default button text for input types
   */
  private getDefaultButtonText(type: string): string {
    switch (type) {
      case 'submit': return 'Submit';
      case 'reset': return 'Reset';
      default: return '';
    }
  }

  /**
   * Check if element is labelable
   */
  private isLabelableElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const labelableElements = ['button', 'input', 'keygen', 'meter', 'output', 'progress', 'select', 'textarea'];
    
    if (labelableElements.includes(tagName)) {
      if (tagName === 'input') {
        const inputType = (element as HTMLInputElement).type.toLowerCase();
        return inputType !== 'hidden';
      }
      return true;
    }
    
    return false;
  }

  /**
   * Get text from associated labels
   */
  private getLabelText(element: HTMLElement, context: any): string {
    const labels: string[] = [];

    // Get labels by for attribute
    if (element.id) {
      const labelElements = document.querySelectorAll(`label[for="${CSS.escape(element.id)}"]`);
      for (const label of labelElements) {
        const childContext = {
          ...context,
          isLabelTraversal: true,
          visited: new Set(context.visited)
        };
        const labelText = this.computeAccessibleName(label as HTMLElement, childContext);
        if (labelText) {
          labels.push(labelText);
        }
      }
    }

    // Get enclosing label
    const enclosingLabel = element.closest('label');
    if (enclosingLabel) {
      const childContext = {
        ...context,
        isLabelTraversal: true,
        visited: new Set(context.visited)
      };
      const labelText = this.computeAccessibleName(enclosingLabel, childContext);
      if (labelText) {
        labels.push(labelText);
      }
    }
    return labels.join(' ');
  }

  /**
   * Check if element is an embedded control
   */
  private isEmbeddedControl(element: HTMLElement): boolean {
    const role = element.getAttribute('role');
    const tagName = element.tagName.toLowerCase();
    
    const controlRoles = ['textbox', 'button', 'combobox', 'listbox', 'slider', 'spinbutton', 'menubutton'];
    const controlElements = ['input', 'select', 'textarea', 'button'];
    
    return controlRoles.includes(role || '') || controlElements.includes(tagName);
  }

  /**
   * Get value from embedded control
   */
  private getEmbeddedControlValue(element: HTMLElement): string {
    const role = element.getAttribute('role');
    const tagName = element.tagName.toLowerCase();

    // Handle by role
    if (role) {
      switch (role) {
        case 'textbox':
          if (tagName === 'input' || tagName === 'textarea') {
            return (element as HTMLInputElement).value || '';
          }
          return '';

        case 'button':
        case 'menubutton':
          return this.computeAccessibleName(element, { ...arguments[1], isRecursion: true });

        case 'combobox':
        case 'listbox':
          return this.getSelectedOptionText(element);

        case 'slider':
        case 'spinbutton':
          return this.getRangeValue(element);
      }
    }

    // Handle by tag name
    switch (tagName) {
      case 'input':
        const inputElement = element as HTMLInputElement;
        const type = inputElement.type.toLowerCase();
        if (['text', 'password', 'email', 'tel', 'url', 'search'].includes(type)) {
          return inputElement.value || '';
        }
        if (['range', 'number'].includes(type)) {
          return this.getRangeValue(element);
        }
        break;

      case 'select':
        return this.getSelectedOptionText(element);

      case 'textarea':
        return (element as HTMLTextAreaElement).value || '';
    }

    return '';
  }

  /**
   * Get selected option text for select/combobox/listbox
   */
  private getSelectedOptionText(element: HTMLElement): string {
    const role = element.getAttribute('role');
    
    if (role === 'combobox') {
      const textbox = element.querySelector('[role="textbox"]');
      if (textbox) {
        return (textbox as HTMLInputElement).value || '';
      }
      
      const listbox = element.querySelector('[role="listbox"]');
      if (listbox) {
        const selectedOption = listbox.querySelector('[role="option"][aria-selected="true"]');
        if (selectedOption) {
          return selectedOption.textContent?.trim() || '';
        }
      }
    } else if (role === 'listbox') {
      const selectedOption = element.querySelector('[role="option"][aria-selected="true"]');
      if (selectedOption) {
        return selectedOption.textContent?.trim() || '';
      }
    } else if (element.tagName.toLowerCase() === 'select') {
      const selectElement = element as HTMLSelectElement;
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      return selectedOption?.text || '';
    }

    return '';
  }

  /**
   * Get range value (slider/spinbutton)
   */
  private getRangeValue(element: HTMLElement): string {
    // Check aria-valuetext first
    const valueText = element.getAttribute('aria-valuetext');
    if (valueText?.trim()) {
      return valueText.trim();
    }

    // Then aria-valuenow
    const valueNow = element.getAttribute('aria-valuenow');
    if (valueNow?.trim()) {
      return valueNow.trim();
    }

    // Finally check native value
    if (element.tagName.toLowerCase() === 'input') {
      const inputElement = element as HTMLInputElement;
      if (inputElement.type === 'range' || inputElement.type === 'number') {
        return inputElement.value || '';
      }
    }

    return '';
  }

  /**
   * Check if element allows name from content
   */
  private allowsNameFromContent(element: HTMLElement): boolean {
    const role = element.getAttribute('role');
    const tagName = element.tagName.toLowerCase();

    // Elements that allow name from content by default
    const nameFromContentElements = ['a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'legend', 'summary', 'th'];
    const nameFromContentRoles = [
      'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link', 
      'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row', 
      'rowheader', 'switch', 'tab', 'tooltip', 'treeitem'
    ];

    if (role && nameFromContentRoles.includes(role)) {
      return true;
    }

    if (nameFromContentElements.includes(tagName)) {
      return true;
    }

    return false;
  }

  /**
   * Get text content from element children with CSS pseudo-content
   */
  private getTextFromContent(element: HTMLElement, context: any): string {
    const accumulatedText: string[] = [];

    // Get CSS :before content
    const beforeContent = this.getPseudoContent(element, '::before');
    if (beforeContent) {
      accumulatedText.push(beforeContent);
    }

    // Process child nodes
    const childContext = {
      ...context,
      isRecursion: true,
      visited: new Set(context.visited)
    };

    for (const childNode of element.childNodes) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        const text = childNode.nodeValue?.trim();
        if (text) {
          accumulatedText.push(text);
        }
      } else if (childNode.nodeType === Node.ELEMENT_NODE) {
        const childElement = childNode as HTMLElement;
        const childText = this.computeAccessibleName(childElement, childContext);
        if (childText) {
          accumulatedText.push(childText);
        }
      }
    }

    // Get CSS :after content
    const afterContent = this.getPseudoContent(element, '::after');
    if (afterContent) {
      accumulatedText.push(afterContent);
    }

    return accumulatedText.join(' ').trim();
  }

  /**
   * Get CSS pseudo-element content
   */
  private getPseudoContent(element: HTMLElement, pseudoElement: string): string {
    try {
      const style = window.getComputedStyle(element, pseudoElement);
      const content = style.getPropertyValue('content');
      
      // Remove quotes from content value
      const match = /^"(.*)"$/.exec(content);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  init(): void {
    chrome?.runtime?.onMessage.addListener(
      (request: PanelIntercom, sender, sendResponse) => {
        switch (request.command) {
          case 'setState':
            break;
          case 'reset':
            break;
          default:
            break;
        }
      }
    );
  }
}

const nerdeRegionCS = new NerdeRegionCS();
nerdeRegionCS.init();