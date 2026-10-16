/**
 * Brand sheet logic: the colour swatches.
 *
 * Builds the six swatch cards shown on brand.html. The page has no other behaviour.
 */

class Component extends DCLogic {
  renderVals() {
    // Shared layout for every swatch card.
    const base =
      'box-sizing:border-box;flex:1 1 200px;min-width:0;min-height:170px;border-radius:14px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:24px;';

    /**
     * Makes one swatch: name, hex value, where it is used, text colour, and whether it needs a
     * border (Paper does).
     */
    const mk = (name, hex, use, fg, bordered) => ({
      name: name,
      hex: hex,
      use: use,
      style:
        base +
        'background:' +
        hex +
        ';color:' +
        fg +
        ';border:1px solid ' +
        (bordered ? '#D3DBD5' : hex),
    });
    return {
      // The Deductly palette. Wattle is used once per screen, as a highlight.
      swatches: [
        mk(
          'Deductly Green',
          '#185034',
          'The logo, buttons, links and key figures.',
          '#FFFFFF',
          false,
        ),
        mk('Deep Green', '#10392C', 'Dark bands and the profile summary card.', '#EAF1EC', false),
        mk(
          'Sage',
          '#738574',
          'The tagline and quiet decoration. Not for body text.',
          '#FFFFFF',
          false,
        ),
        mk('Ink', '#11231C', 'Body text and headings.', '#FFFFFF', false),
        mk('Paper', '#F3F5F1', 'The page background.', '#11231C', true),
        mk('Wattle', '#F2C230', 'One highlight per screen.', '#11231C', false),
      ],
    };
  }
}

DC.mount(Component);
