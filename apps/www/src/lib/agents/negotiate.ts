interface MediaRange {
  index: number;
  q: number;
  /** 2 for `text/markdown`, 1 for `text/*`, 0 for `*\/*`. */
  specificity: number;
  subtype: string;
  type: string;
}

function parseAccept(accept: string): MediaRange[] {
  return accept.split(",").flatMap((entry, index) => {
    const [range = "", ...params] = entry
      .split(";")
      .map((part) => part.trim().toLowerCase());
    const [type, subtype] = range.split("/");
    if (!(type && subtype) || (type === "*" && subtype !== "*")) {
      return [];
    }
    const qParam = params.find((param) => param.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (!(q >= 0 && q <= 1)) {
      return [];
    }
    const specificity = (type === "*" ? 0 : 1) + (subtype === "*" ? 0 : 1);
    return [{ index, q, specificity, subtype, type }];
  });
}

/** The range that decides how much the request wants a type: the most specific one that matches it. */
function rangeFor(ranges: MediaRange[], offer: string) {
  const [type, subtype] = offer.split("/");
  let best: MediaRange | undefined;
  for (const range of ranges) {
    const matches =
      (range.type === "*" || range.type === type) &&
      (range.subtype === "*" || range.subtype === subtype);
    if (
      matches &&
      (!best ||
        range.specificity > best.specificity ||
        (range.specificity === best.specificity && range.q > best.q))
    ) {
      best = range;
    }
  }
  return best;
}

/**
 * Proactive negotiation (RFC 9110, 12.5.1): which of the types a server can
 * send the request's `Accept` prefers. The highest q wins; at the same q the
 * more specific range (`text/markdown` over `text/*` over `*\/*`), then the
 * range listed first. A type its range gives `q=0` is refused, and a header
 * of refusals alone takes anything else. Without an `Accept`, or when it
 * takes anything, the first offer is the default. Nothing acceptable is
 * `undefined`: the server's answer is a 406.
 */
export function negotiate(
  accept: string | null,
  offers: readonly string[]
): string | undefined {
  if (!accept?.trim()) {
    return offers[0];
  }
  const ranges = parseAccept(accept);
  let chosen: { offer: string; range: MediaRange } | undefined;
  for (const offer of offers) {
    const range = rangeFor(ranges, offer);
    if (!range || range.q === 0) {
      continue;
    }
    if (
      !chosen ||
      range.q > chosen.range.q ||
      (range.q === chosen.range.q &&
        (range.specificity > chosen.range.specificity ||
          (range.specificity === chosen.range.specificity &&
            range.index < chosen.range.index)))
    ) {
      chosen = { offer, range };
    }
  }
  if (!chosen && ranges.length > 0 && ranges.every((range) => range.q === 0)) {
    return offers.find((offer) => !rangeFor(ranges, offer));
  }
  return chosen?.offer;
}
