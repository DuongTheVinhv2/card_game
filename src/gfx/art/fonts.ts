// Font registration for the canvas painters. Importing the @fontsource CSS registers the
// @font-face rules; loadCardFonts() forces every face/weight we paint with to be loaded.
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/marcellus/400.css';

export const F_CINZEL = 'Cinzel, "Trajan Pro", Georgia, serif';
export const F_DECO = '"Cinzel Decorative", Cinzel, Georgia, serif';
export const F_MARCELLUS = 'Marcellus, Georgia, serif';

const FACES = [
  '400 32px Cinzel',
  '700 32px Cinzel',
  '900 32px Cinzel',
  '700 32px "Cinzel Decorative"',
  '400 32px Marcellus',
];
const SAMPLE = 'AJQK 0123456789 DODEKATHLOS Aa';

let loading: Promise<void> | null = null;
let ready = false;

/** true once every face used by the painters is available to canvas */
export function cardFontsReady(): boolean {
  if (ready) return true;
  if (typeof document === 'undefined' || !document.fonts) return false;
  ready = FACES.every((f) => document.fonts.check(f, SAMPLE));
  return ready;
}

/** call once before painting; resolves when the fonts are ready for canvas use */
export function loadCardFonts(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      await Promise.all(FACES.map((f) => document.fonts.load(f, SAMPLE).catch(() => [])));
      await document.fonts.ready;
      cardFontsReady();
    })();
  }
  return loading;
}
